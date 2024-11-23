const express = require('express');
const multer = require('multer');
const path = require('path');
const pdf = require('pdf-parse');
const cors = require('cors');
const fs = require('fs');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
const port = 3000;

// Initialize Gemini
const genAI = new GoogleGenerativeAI("AIzaSyAh_1beBkpfNj2oR4Eybu8PrrcnFRcDwy8");
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Configure multer for file upload
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/')
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname))
    }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: function(req, file, cb) {
        if (path.extname(file.originalname) !== '.pdf') {
            return cb(new Error('Only PDF files are allowed'));
        }
        cb(null, true);
    }
});

// Sample job description
const sampleJobDescription = `
We are looking for a Cyber security analyst with:
- Strong knowledge of cyber tools and vapt
- Good communication skills
- Bachelor's degree in Computer Science or related field
`;

async function analyzeResumeWithGemini(resumeText) {
    try {
        const prompt = `
            Analyze this resume against the following job description:
            ${sampleJobDescription}

            Please provide a JSON response with the following structure:
            {
                "score": (0-100 score based on match with job description),
                "analysis": {
                    "strengths": [list of key strengths],
                    "weaknesses": [list of areas for improvement],
                    "scoringBreakdown": {
                        "relevance": (0-25 score for job relevance),
                        "experience": (0-25 score for experience quality),
                        "skills": (0-25 score for technical skills match),
                        "formatting": (0-25 score for resume formatting and clarity)
                    }
                }
            }

            Resume text:
            ${resumeText}

            Important: Ensure the response is valid JSON format with no trailing commas.
        `;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        
        // Log the raw response for debugging
        console.log('Raw Gemini response:', responseText);
        
        // Try to extract JSON from the response
        let jsonStr = responseText;
        
        // If the response contains markdown code blocks, extract the JSON
        if (responseText.includes('```json')) {
            jsonStr = responseText.split('```json')[1].split('```')[0].trim();
        } else if (responseText.includes('```')) {
            jsonStr = responseText.split('```')[1].split('```')[0].trim();
        }
        
        // Remove any potential trailing commas
        jsonStr = jsonStr.replace(/,(\s*[}\]])/g, '$1');
        
        // Attempt to parse the JSON
        try {
            const parsedData = JSON.parse(jsonStr);
            
            // Validate the required structure
            if (!parsedData.score || !parsedData.analysis || !parsedData.analysis.scoringBreakdown) {
                throw new Error('Invalid response structure');
            }
            
            // Ensure arrays are present
            parsedData.analysis.strengths = Array.isArray(parsedData.analysis.strengths) 
                ? parsedData.analysis.strengths 
                : [];
            parsedData.analysis.weaknesses = Array.isArray(parsedData.analysis.weaknesses) 
                ? parsedData.analysis.weaknesses 
                : [];
            
            return parsedData;
        } catch (parseError) {
            console.error('JSON parsing error:', parseError);
            console.error('Attempted to parse:', jsonStr);
            
            // Return a fallback response
            return {
                success: false,
                score: 0,
                analysis: {
                    strengths: ['Error analyzing resume'],
                    weaknesses: ['Unable to process resume'],
                    scoringBreakdown: {
                        relevance: 0,
                        experience: 0,
                        skills: 0,
                        formatting: 0
                    }
                }
            };
        }
    } catch (error) {
        console.error('Error analyzing resume with Gemini:', error);
        throw error;
    }
}

// Routes
app.post('/upload', upload.single('resume'), async (req, res) => {
    try {
        if (!req.file) {
            throw new Error('No file uploaded');
        }

        const dataBuffer = fs.readFileSync(req.file.path);
        const data = await pdf(dataBuffer);
        const text = data.text;
        
        // Analyze with Gemini
        const analysis = await analyzeResumeWithGemini(text);
        
        // Clean up uploaded file
        fs.unlinkSync(req.file.path);
        
        res.json({
            success: true,
            ...analysis
        });
    } catch (error) {
        console.error('Error processing resume:', error);
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

// Start server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
    
    // Create uploads directory if it doesn't exist
    if (!fs.existsSync('uploads')){
        fs.mkdirSync('uploads');
    }
});
      

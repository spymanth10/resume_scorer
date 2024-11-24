const fs = require('fs');
const PDFDocument = require('pdfkit');

function createReport(analysis) {
    const doc = new PDFDocument();
    const reportPath = `reports/report-${Date.now()}.pdf`;
    
    doc.pipe(fs.createWriteStream(reportPath));

    doc.fontSize(20).text('Resume Analysis Report', { align: 'center' });
    doc.moveDown();

    doc.fontSize(16).text(`Overall Score: ${analysis.score}`);
    
    doc.moveDown();
    doc.fontSize(14).text('Score Breakdown:');
    
    const { scoringBreakdown } = analysis.analysis;
    
    doc.text(`Job Relevance: ${scoringBreakdown.relevance}/25`);
    doc.text(`Experience: ${scoringBreakdown.experience}/25`);
    doc.text(`Technical Skills: ${scoringBreakdown.skills}/25`);
    doc.text(`Formatting: ${scoringBreakdown.formatting}/25`);

    doc.moveDown();
    
    doc.fontSize(14).text('Key Strengths:', { underline: true });
    analysis.analysis.strengths.forEach(strength => {
      doc.text(`- ${strength}`);
    });

    doc.moveDown();
    
    doc.fontSize(14).text('Areas for Improvement:', { underline: true });
    analysis.analysis.weaknesses.forEach(weakness => {
      doc.text(`- ${weakness}`);
    });

    doc.end();

    return reportPath;
}

module.exports = { createReport };
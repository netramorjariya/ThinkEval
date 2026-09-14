const PDFDocument = require('pdfkit');

function drawHeading(doc, text) {
  doc.moveDown(0.5).fontSize(14).fillColor('#111827').text(text, { underline: false });
  doc.moveDown(0.2);
}

function drawBulletList(doc, items) {
  doc.fontSize(10).fillColor('#374151');
  if (!items || items.length === 0) {
    doc.text('None recorded.', { indent: 12 });
    return;
  }
  items.forEach((item) => doc.text(`•  ${item}`, { indent: 12 }));
}

/** Streams a PDF evaluation report directly to the given writable stream (e.g. an HTTP response). */
function streamEvaluationReport({ student, assessment, caseStudy, evaluation, result }, writeStream) {
  const doc = new PDFDocument({ margin: 50 });
  doc.pipe(writeStream);

  doc.fontSize(20).fillColor('#111827').text('ThinkEval — Evaluation Report', { align: 'left' });
  doc.moveDown(0.3);
  doc.fontSize(10).fillColor('#6b7280').text(`Generated ${new Date().toLocaleString()}`);
  doc.moveDown();

  drawHeading(doc, 'Student');
  doc.fontSize(10).fillColor('#374151').text(`Name: ${student.name}`);
  doc.text(`Student ID: ${student.studentId || '-'}`);
  doc.text(`Course: ${student.course || '-'}  |  Semester: ${student.semester || '-'}  |  Section: ${student.section || '-'}`);

  drawHeading(doc, 'Assessment');
  doc.fontSize(10).fillColor('#374151').text(`Title: ${assessment.title}`);
  doc.text(`Difficulty: ${assessment.difficulty}`);
  if (caseStudy) {
    doc.moveDown(0.2).fontSize(11).fillColor('#111827').text(caseStudy.title, { bold: true });
    doc.fontSize(10).fillColor('#374151').text(caseStudy.scenario, { align: 'justify' });
  }

  const finalScore = result ? result.finalScore : evaluation.review?.finalScore ?? evaluation.ai?.overallScore;
  const maxScore = result ? result.maxScore : 100;
  drawHeading(doc, 'Overall Score');
  doc.fontSize(18).fillColor('#111827').text(`${finalScore} / ${maxScore}`);
  if (result?.grade) doc.fontSize(11).fillColor('#374151').text(`Grade: ${result.grade}`);

  drawHeading(doc, 'Criterion-wise Marks');
  const criteria = evaluation.review?.modifiedCriteria?.length ? evaluation.review.modifiedCriteria : evaluation.ai?.criteria || [];
  doc.fontSize(10).fillColor('#374151');
  criteria.forEach((c) => doc.text(`${c.name}: ${c.scoreAwarded} / ${c.maxMarks}`, { indent: 12 }));

  drawHeading(doc, 'Strengths');
  drawBulletList(doc, evaluation.ai?.strengths);

  drawHeading(doc, 'Weaknesses');
  drawBulletList(doc, evaluation.ai?.weaknesses);

  drawHeading(doc, 'Recommendations');
  drawBulletList(doc, evaluation.ai?.recommendations);

  if (evaluation.review?.comment) {
    drawHeading(doc, 'Evaluator Comments');
    doc.fontSize(10).fillColor('#374151').text(evaluation.review.comment);
  }

  drawHeading(doc, 'AI Confidence');
  doc.fontSize(10).fillColor('#374151').text(`${evaluation.ai?.confidenceScore ?? '-'}%`);
  if (evaluation.ai?.manualReviewRecommended) {
    doc.fillColor('#b45309').text('Manual review was recommended for this submission.');
  }

  doc.end();
}

module.exports = { streamEvaluationReport };

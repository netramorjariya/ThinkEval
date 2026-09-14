function scoreToGrade(pct) {
  if (pct >= 90) return 'Outstanding';
  if (pct >= 75) return 'Excellent';
  if (pct >= 60) return 'Good';
  if (pct >= 45) return 'Satisfactory';
  if (pct >= 35) return 'Needs Improvement';
  return 'Unsatisfactory';
}

module.exports = { scoreToGrade };

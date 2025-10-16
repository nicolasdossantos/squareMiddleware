/**
 * Get a human-readable relative timeframe for a booking
 * @param {Date|string} bookingDate - The booking start date
 * @param {string} timezone - Timezone (e.g., 'America/New_York')
 * @returns {string} - 'today', 'tomorrow', 'in 2 days', 'in 3 weeks', etc.
 */
function getRelativeTimeframe(bookingDate, timezone = 'America/New_York') {
  const booking = typeof bookingDate === 'string' ? new Date(bookingDate) : bookingDate;
  const now = new Date();

  // Get start of today in the specified timezone
  const todayStart = new Date(
    now.toLocaleString('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    })
  );
  todayStart.setHours(0, 0, 0, 0);

  // Get start of booking day in the specified timezone
  const bookingStart = new Date(
    booking.toLocaleString('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    })
  );
  bookingStart.setHours(0, 0, 0, 0);

  // Calculate difference in days
  const diffTime = bookingStart.getTime() - todayStart.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return 'today';
  } else if (diffDays === 1) {
    return 'tomorrow';
  } else if (diffDays === -1) {
    return 'yesterday';
  } else if (diffDays > 1 && diffDays <= 6) {
    return `in ${diffDays} days`;
  } else if (diffDays >= 7 && diffDays <= 13) {
    return 'next week';
  } else if (diffDays >= 14 && diffDays <= 30) {
    const weeks = Math.floor(diffDays / 7);
    return `in ${weeks} weeks`;
  } else if (diffDays > 30 && diffDays <= 60) {
    return 'next month';
  } else if (diffDays > 60) {
    const months = Math.floor(diffDays / 30);
    return `in ${months} months`;
  } else if (diffDays < -1 && diffDays >= -6) {
    return `${Math.abs(diffDays)} days ago`;
  } else if (diffDays < -6) {
    const weeksAgo = Math.floor(Math.abs(diffDays) / 7);
    return `${weeksAgo} ${weeksAgo === 1 ? 'week' : 'weeks'} ago`;
  }

  return `in ${diffDays} days`;
}

module.exports = {
  getRelativeTimeframe
};

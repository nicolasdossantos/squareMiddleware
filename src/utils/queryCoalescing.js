/**
 * Query Coalescing Service
 *
 * Prevents redundant API calls by coalescing multiple concurrent requests
 * for the same data into a single request.
 *
 * Example: If 100 concurrent requests ask for the same catalog data,
 * only 1 API call is made and all 100 requests receive the same result.
 *
 * Benefits:
 * - Reduces API calls to Square (cost savings)
 * - Reduces latency (no duplicate work)
 * - Prevents rate limiting
 *
 * Usage:
 * ```js
 * const result = await queryCoalescer.coalesce(
 *   'catalog-services-tenant123',  // unique key
 *   () => square.catalogApi.listCatalog(...),  // API call
 *   5000  // TTL in ms (optional)
 * );
 * ```
 */

const { logger } = require('./logger');

class QueryCoalescer {
  constructor() {
    // Pending requests: { [key]: Promise }
    this.pendingRequests = new Map();

    // Request metadata for monitoring
    this.stats = {
      totalRequests: 0,
      coalescedRequests: 0,
      uniqueKeys: new Set()
    };
  }

  /**
   * Coalesce multiple requests for the same data
   * @param {string} key - Unique key for this request (e.g., 'catalog-tenant123')
   * @param {Function} fetchFn - Async function that fetches the data
   * @param {number} ttl - Time to live for in-flight request cache (ms)
   * @returns {Promise} Result of the fetch function
   */
  async coalesce(key, fetchFn, ttl = 5000) {
    this.stats.totalRequests++;
    this.stats.uniqueKeys.add(key);

    // Check if there's already a pending request for this key
    if (this.pendingRequests.has(key)) {
      this.stats.coalescedRequests++;

      logger.debug('Query coalesced - reusing in-flight request', {
        key,
        coalescedCount: this.stats.coalescedRequests
      });

      // Wait for existing request
      return this.pendingRequests.get(key);
    }

    // Create new request
    const requestPromise = (async () => {
      try {
        const result = await fetchFn();

        // Keep result in cache for TTL duration
        setTimeout(() => {
          this.pendingRequests.delete(key);
        }, ttl);

        return result;
      } catch (error) {
        // Remove from cache immediately on error
        this.pendingRequests.delete(key);
        throw error;
      }
    })();

    // Store pending request
    this.pendingRequests.set(key, requestPromise);

    logger.debug('Query coalescing - new request initiated', { key });

    return requestPromise;
  }

  /**
   * Get coalescing statistics
   * @returns {Object} Stats about coalescing effectiveness
   */
  getStats() {
    return {
      totalRequests: this.stats.totalRequests,
      coalescedRequests: this.stats.coalescedRequests,
      uniqueKeys: this.stats.uniqueKeys.size,
      coalescingRate:
        this.stats.totalRequests > 0
          ? ((this.stats.coalescedRequests / this.stats.totalRequests) * 100).toFixed(2) + '%'
          : '0%',
      pendingRequests: this.pendingRequests.size
    };
  }

  /**
   * Reset statistics (for testing)
   */
  resetStats() {
    this.stats = {
      totalRequests: 0,
      coalescedRequests: 0,
      uniqueKeys: new Set()
    };
  }

  /**
   * Clear all pending requests (for shutdown)
   */
  clear() {
    this.pendingRequests.clear();
    logger.info('Query coalescer cleared', {
      clearedRequests: this.pendingRequests.size
    });
  }
}

// Export singleton instance
module.exports = new QueryCoalescer();

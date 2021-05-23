/**
 * INTERNAL METHOD!
 * This method acts as an asynchronous forEach loop.
 * @param {Array} items
 * @param {Function} handler
 * @returns {Promise} Promise
 */
function async_for_each(items, handler, cursor = 0, final) {
    // Return a top level promise to be resolved after cursor hits last item
    if (final == undefined)
        return new Promise((res, _) => async_for_each(items, handler, 0, res));

    // Iterate through each item and call each handler with iteration onto next with next callback
    if (cursor < items.length)
        return handler(items[cursor], () =>
            async_for_each(items, handler, cursor + 1, final)
        );

    // Resolve master promise at end of exeuction
    return final();
}

function throttled_for_each(
    items,
    per_eloop = 300,
    handler,
    cursor = 0,
    final
) {
    // Return top level promise which is resolved after execution
    if (final == undefined)
        return new Promise((resolve, reject) => {
            if (items.length == 0) return resolve();
            return throttled_for_each(
                items,
                per_eloop,
                handler,
                cursor,
                resolve
            );
        });

    // Calculuate upper bound and perform synchronous for loop
    let upper_bound =
        cursor + per_eloop >= items.length ? items.length : cursor + per_eloop;
    for (let i = cursor; i < upper_bound; i++) handler(items[i]);

    // Offset cursor and queue next iteration with a timeout
    cursor = upper_bound;
    if (cursor < items.length)
        return setTimeout(
            (a, b, c, d, e) => throttled_for_each(a, b, c, d, e),
            0,
            items,
            per_eloop,
            handler,
            cursor,
            final
        );

    return final();
}

module.exports = {
    async_for_each: async_for_each,
    throttled_for_each: throttled_for_each,
};

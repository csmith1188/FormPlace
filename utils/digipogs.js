// Pricing table with bulk discounts
const PRICING = {
    10: { pricePerPixel: 2.0, totalPrice: 20, discount: 0 },
    25: { pricePerPixel: 1.8, totalPrice: 45, discount: 10 },
    50: { pricePerPixel: 1.7, totalPrice: 85, discount: 15 },
    100: { pricePerPixel: 1.6, totalPrice: 160, discount: 20 }
};

/**
 * Calculate price for a pixel pack
 * @param {number} packSize - Size of the pack (10, 25, 50, or 100)
 * @returns {Object} Price information or null if invalid pack size
 */
function calculatePrice(packSize) {
    if (!PRICING[packSize]) {
        return null;
    }
    return PRICING[packSize];
}

/**
 * Purchase pixels using Digipogs transfer via WebSocket
 * @param {Object} formbarSocket - Socket.io client connection to Formbar
 * @param {number} fromUserId - User's Formbar ID (sender)
 * @param {number} toAccountId - Application account ID (receiver)
 * @param {number} packSize - Size of pack to purchase
 * @param {string|number} pin - User's PIN for the transfer (will be converted to number)
 * @param {number} amount - Amount of digipogs to transfer
 * @returns {Promise<Object>} Result of the purchase
 */
function purchasePixels(formbarSocket, fromUserId, toAccountId, packSize, pin, amount) {
    return new Promise((resolve, reject) => {
        if (!formbarSocket || !formbarSocket.connected) {
            reject(new Error('Not connected to Formbar'));
            return;
        }

        // Convert PIN to number (as required by Formbar API)
        const pinNumber = typeof pin === 'string' ? parseInt(pin, 10) : pin;
        
        if (isNaN(pinNumber)) {
            reject(new Error('Invalid PIN'));
            return;
        }

        // Set up one-time listener for transfer response
        const responseHandler = (response) => {
            formbarSocket.off('transferResponse', responseHandler);
            
            if (response.success) {
                resolve({
                    success: true,
                    packSize: packSize,
                    pixelsPurchased: packSize,
                    digipogsSpent: amount,
                    discountPercent: PRICING[packSize].discount,
                    message: response.message
                });
            } else {
                reject(new Error(response.message || 'Transfer failed'));
            }
        };

        // Listen for transfer response
        formbarSocket.once('transferResponse', responseHandler);

        // Send transfer request
        formbarSocket.emit('transferDigipogs', {
            from: fromUserId,
            to: toAccountId,
            amount: amount,
            reason: `Purchase ${packSize} pixels`,
            pin: pinNumber,
            pool: true
        });

        // Set timeout in case no response is received
        setTimeout(() => {
            formbarSocket.off('transferResponse', responseHandler);
            reject(new Error('Transfer timeout - no response from Formbar'));
        }, 10000); // 10 second timeout
    });
}

module.exports = {
    calculatePrice,
    purchasePixels,
    PRICING
};


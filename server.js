const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Path to trades.json file
const TRADES_FILE = path.join(__dirname, 'trades.json');

// Initialize trades.json if it doesn't exist or is empty
if (!fs.existsSync(TRADES_FILE)) {
    fs.writeFileSync(TRADES_FILE, JSON.stringify([], null, 2));
    console.log('✅ Created trades.json file');
} else {
    // Check if file is empty or invalid
    const content = fs.readFileSync(TRADES_FILE, 'utf8');
    if (!content.trim() || content === '[]') {
        fs.writeFileSync(TRADES_FILE, JSON.stringify([], null, 2));
        console.log('✅ Initialized empty trades.json');
    }
}

// Helper function to read trades from file
function readTrades() {
    try {
        const data = fs.readFileSync(TRADES_FILE, 'utf8');
        if (!data.trim()) return [];
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading trades.json:', error);
        return [];
    }
}

// Helper function to write trades to file
function writeTrades(trades) {
    try {
        fs.writeFileSync(TRADES_FILE, JSON.stringify(trades, null, 2));
        console.log('💾 Auto-saved to trades.json:', trades.length, 'trades');
        console.log('📄 File content preview:', JSON.stringify(trades, null, 2).substring(0, 200));
        return true;
    } catch (error) {
        console.error('Error writing to trades.json:', error);
        return false;
    }
}

// API Routes

// Get all trades
app.get('/api/trades', (req, res) => {
    console.log('📥 GET /api/trades - Fetching all trades');
    const trades = readTrades();
    res.json(trades);
});

// Add a new trade (auto-writes to file)
app.post('/api/trades', (req, res) => {
    const newTrade = req.body;
    
    // Validate trade data
    if (!newTrade.orderId || !newTrade.date || 
        typeof newTrade.quantity !== 'number' ||
        typeof newTrade.buyRate !== 'number' ||
        typeof newTrade.sellRate !== 'number' ||
        typeof newTrade.profit !== 'number') {
        return res.status(400).json({ error: 'Invalid trade data', received: newTrade });
    }

    // ✅ Server‑side authoritative calculation
    const qty = newTrade.quantity;
    const buy = newTrade.buyRate;
    const sell = newTrade.sellRate;

    newTrade.usdtQuantity = qty / buy;
    newTrade.grossQuantity = newTrade.usdtQuantity * sell;
    newTrade.profit = newTrade.grossQuantity - qty;

    
    const trades = readTrades();
    trades.push(newTrade);
    
    // Auto-write to trades.json file
    const saved = writeTrades(trades);
    
    if (saved) {
        console.log('✅ Trade saved successfully. Total trades:', trades.length);
        res.json({ success: true, trade: newTrade, totalTrades: trades.length });
    } else {
        res.status(500).json({ error: 'Failed to save to trades.json' });
    }
});

// Delete a trade by orderId
app.delete('/api/trades/:orderId', (req, res) => {
    const orderId = parseInt(req.params.orderId);
    console.log('🗑️ DELETE /api/trades/', orderId);
    
    let trades = readTrades();
    const initialLength = trades.length;
    trades = trades.filter(t => t.orderId !== orderId);
    
    if (trades.length === initialLength) {
        return res.status(404).json({ error: 'Trade not found' });
    }
    
    // Auto-write to trades.json file
    const saved = writeTrades(trades);
    
    if (saved) {
        res.json({ success: true, totalTrades: trades.length });
    } else {
        res.status(500).json({ error: 'Failed to save to trades.json' });
    }
});

// Reset all trades (clear database)
app.delete('/api/trades', (req, res) => {
    console.log('🗑️ DELETE /api/trades - Resetting all trades');
    const saved = writeTrades([]);
    
    if (saved) {
        res.json({ success: true, message: 'All trades cleared' });
    } else {
        res.status(500).json({ error: 'Failed to clear trades.json' });
    }
});

// Get database stats
app.get('/api/stats', (req, res) => {
    const trades = readTrades();
    const totalProfit = trades.reduce((sum, t) => sum + t.profit, 0);
    res.json({
        totalTrades: trades.length,
        totalProfit: totalProfit,
        btdShare: totalProfit / 2,
        srtShare: totalProfit / 2
    });
});

// Root route - serve index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`
    ╔══════════════════════════════════════════════════════════════╗
    ║                                                              ║
    ║   🚀 TRADING PARTNER LEDGER SERVER STARTED                   ║
    ║                                                              ║
    ║   Server URL: http://localhost:${PORT}                        ║
    ║   API URL:    http://localhost:${PORT}/api/trades             ║
    ║                                                              ║
    ║   ✅ trades.json will auto-save on every change              ║
    ║   📁 File location: ${TRADES_FILE}                            ║
    ║                                                              ║
    ║   Open your browser to: http://localhost:${PORT}              ║
    ║                                                              ║
    ╚══════════════════════════════════════════════════════════════╝
    `);
});
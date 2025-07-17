
const express = require('express');
const { createClient } = require('redis');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Redis client
const redis = createClient({
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379
});

redis.connect().catch(console.error);

// Handle Redis connection events
redis.on('error', (err) => {
    console.error('Redis connection error:', err);
});

redis.on('connect', () => {
    console.log('Connected to Redis');
});

// Mock PR data - in a real app, this would come from a database
const prs = [
    { id: 1, plant: "PlantA", amount: 25000, description: "Raw materials for PlantA", status: "pending" },
    { id: 2, plant: "PlantB", amount: 45000, description: "Equipment for PlantB", status: "approved" },
    { id: 3, plant: "PlantC", amount: 75000, description: "Maintenance for PlantC", status: "pending" },
    { id: 4, plant: "PlantA", amount: 15000, description: "Office supplies for PlantA", status: "approved" },
    { id: 5, plant: "PlantB", amount: 60000, description: "Heavy machinery for PlantB", status: "rejected" },
    { id: 6, plant: "PlantD", amount: 30000, description: "IT equipment for PlantD", status: "pending" },
    { id: 7, plant: "PlantA", amount: 80000, description: "Infrastructure upgrade for PlantA", status: "pending" },
    { id: 8, plant: "PlantC", amount: 20000, description: "Safety equipment for PlantC", status: "approved" }
];

// Load permissions from file
let permissionConfig;
try {
    const configPath = path.join(__dirname, 'permission.json');
    permissionConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    console.log('Permission config loaded:', permissionConfig);
} catch (error) {
    console.error('Error loading permission config:', error);
    // Fallback config for demonstration
    permissionConfig = {
        role: "buyer",
        dataPermissions: {
            allowedPlants: ["PlantA", "PlantB"],
            maxAmount: 50000
        }
    };
}

const PERMISSION_KEY = `user:permissions:${permissionConfig.role}`;

// Cache permissions in Redis
async function cachePermissions() {
    try {
        await redis.set(PERMISSION_KEY, JSON.stringify(permissionConfig.dataPermissions));
        console.log("Permissions cached in Redis for role:", permissionConfig.role);
    } catch (error) {
        console.error('Error caching permissions:', error);
    }
}

// Initialize permissions cache on startup
cachePermissions();

// Middleware
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        success: true, 
        message: 'API is running',
        role: permissionConfig.role,
        timestamp: new Date().toISOString()
    });
});

// API: /getPRs - Get filtered PRs based on user permissions
app.get('/getPRs', async (req, res) => {
    try {
        // Load permissions from Redis
        const cached = await redis.get(PERMISSION_KEY);
        if (!cached) {
            return res.status(500).json({ 
                success: false, 
                message: "Permissions not found in cache. Please contact administrator." 
            });
        }

        const permissions = JSON.parse(cached);
        const allowedPlants = permissions.allowedPlants || [];
        const maxAmount = permissions.maxAmount || Infinity;

        console.log('Applying filters:', { allowedPlants, maxAmount });

        // Apply filters based on permissions
        const filteredPRs = prs.filter(pr => {
            const plantAllowed = allowedPlants.length === 0 || allowedPlants.includes(pr.plant);
            const amountAllowed = pr.amount <= maxAmount;
            return plantAllowed && amountAllowed;
        });

        // Additional query parameters for further filtering
        const { status, minAmount, sortBy } = req.query;
        
        let result = filteredPRs;

        // Apply optional status filter
        if (status) {
            result = result.filter(pr => pr.status === status);
        }

        // Apply optional minimum amount filter
        if (minAmount) {
            const min = parseInt(minAmount);
            if (!isNaN(min)) {
                result = result.filter(pr => pr.amount >= min);
            }
        }

        // Apply optional sorting
        if (sortBy) {
            if (sortBy === 'amount') {
                result.sort((a, b) => a.amount - b.amount);
            } else if (sortBy === 'plant') {
                result.sort((a, b) => a.plant.localeCompare(b.plant));
            }
        }

        res.json({ 
            success: true, 
            role: permissionConfig.role,
            totalRecords: prs.length,
            filteredRecords: result.length,
            appliedFilters: {
                allowedPlants,
                maxAmount,
                additionalFilters: { status, minAmount, sortBy }
            },
            data: result
        });

    } catch (err) {
        console.error("Error fetching PRs:", err);
        res.status(500).json({ 
            success: false, 
            message: "Internal Server Error",
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});



// API: /permissions - Get current user permissions
app.get('/permissions', async (req, res) => {
    try {
        const cached = await redis.get(PERMISSION_KEY);
        if (!cached) {
            return res.status(500).json({ 
                success: false, 
                message: "Permissions not found in cache" 
            });
        }

        const permissions = JSON.parse(cached);
        res.json({
            success: true,
            role: permissionConfig.role,
            permissions
        });

    } catch (err) {
        console.error("Error fetching permissions:", err);
        res.status(500).json({ 
            success: false, 
            message: "Internal Server Error" 
        });
    }
});

// API: /refreshPermissions - Reload permissions from file and update cache
app.post('/refreshPermissions', async (req, res) => {
    try {
        // Reload permission config from file
        const configPath = path.join(__dirname, 'permission.json');
        const newConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        
        // Update global config
        permissionConfig = newConfig;
        
        // Update Redis cache
        const newPermissionKey = `user:permissions:${newConfig.role}`;
        await redis.set(newPermissionKey, JSON.stringify(newConfig.dataPermissions));
        
        res.json({
            success: true,
            message: "Permissions refreshed successfully",
            role: newConfig.role,
            permissions: newConfig.dataPermissions
        });

    } catch (err) {
        console.error("Error refreshing permissions:", err);
        res.status(500).json({ 
            success: false, 
            message: "Error refreshing permissions",
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});

// API: /getAllPRs - Get all PRs (for admin debugging - no filters applied)
app.get('/getAllPRs', (req, res) => {
    res.json({
        success: true,
        message: "All PRs (no filters applied)",
        totalRecords: prs.length,
        data: prs
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        success: false,
        message: 'Something went wrong!',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});


const rules = JSON.parse(fs.readFileSync('./business-rules.json', 'utf-8'));

// Calculate delivery days from delivery date
function calculateDeliveryDays(deliveryDate) {
    const now = new Date();
    const target = new Date(deliveryDate);
    const diffTime = target - now;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

// Safe condition evaluator (replaces eval)
function evaluateCondition(condition, totalAmount, deliveryDays) {
    
    // Replace variables with actual values
    const conditionStr = condition
        .replace('totalAmount', totalAmount)
        .replace('deliveryDays', deliveryDays);
    
    // Parse and evaluate simple conditions
    if (conditionStr.includes('<')) {
        const [left, right] = conditionStr.split('<');
        return parseFloat(left.trim()) < parseFloat(right.trim());
    }
    if (conditionStr.includes('>')) {
        const [left, right] = conditionStr.split('>');
        return parseFloat(left.trim()) > parseFloat(right.trim());
    }
    if (conditionStr.includes('>=')) {
        const [left, right] = conditionStr.split('>=');
        return parseFloat(left.trim()) >= parseFloat(right.trim());
    }
    if (conditionStr.includes('<=')) {
        const [left, right] = conditionStr.split('<=');
        return parseFloat(left.trim()) <= parseFloat(right.trim());
    }
    
    return false;
}


let approval_ids = []

app.get('/getPending', (req, res) => {
    console.log(" /getPending hit");
    const pendingApprovals = approval_ids.filter(pr => pr.status === "Manual Approval");
    return res.json({
        success: true,
        message: "Pending approvals",
        data: pendingApprovals
    });
});

app.post('/approvePR/:id', (req, res) => {
    const id = parseInt(req.params.id);

    const index = approval_ids.findIndex(pr => pr.id === id);
    if (index === -1) {
        return res.status(404).json({
            success: false,
            message: `PR with id ${id} not found in pending approvals`
        });
    }

    // Update status to Approved
    approval_ids[index].status = "Approved";

    return res.json({
        success: true,
        message: `PR with id ${id} has been approved`,
        data: approval_ids[index]
    });
});


// Main API: Process Purchase Requisition
app.post('/processPR', (req, res) => {
    try {
        const pr = { ...req.body };

        // Validate required fields
        if (!pr.totalAmount || !pr.deliveryDate) {
            return res.status(400).json({
                success: false,
                message: "totalAmount and deliveryDate are required"
            });
        }

        // Calculate delivery days
        const deliveryDays = calculateDeliveryDays(pr.deliveryDate);
        const totalAmount = pr.totalAmount;

        // Apply business rules
        rules.approvalRules.forEach(rule => {
            try {
                if (evaluateCondition(rule.condition, totalAmount, deliveryDays)) {
                    if (rule.action === 'autoApprove') {
                        pr.status = rule.setStatus;
                    } else if (rule.action === 'setUrgency') {
                        pr.urgency = rule.urgency;
                    }
                }
            } catch (err) {
                console.error('Error evaluating rule:', err);
            }
        });

        // Force manual approval if totalAmount > 10000
        if (totalAmount > 10000) {
            pr.status = "Manual Approval";
            pr.id = Math.floor(Math.random() * 1000000); // Better random ID
            approval_ids.push(pr);
        }

        // Set defaults if not set
        if (!pr.status) pr.status = 'Pending';
        if (!pr.urgency) pr.urgency = 'Normal';

        pr.deliveryDays = deliveryDays;

        res.json({
            success: true,
            processedPR: pr
        });

    } catch (error) {
        console.error('Error processing PR:', error);
        res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Endpoint not found'
    });
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('Shutting down gracefully...');
    try {
        await redis.quit();
        console.log('Redis connection closed');
    } catch (err) {
        console.error('Error closing Redis connection:', err);
    }
    process.exit(0);
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
    console.log(`Get PRs: http://localhost:${PORT}/getPRs`);
});

module.exports = app;

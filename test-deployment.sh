#!/bin/bash

echo "🧪 Testing AI Maker Space Deployment Configuration"
echo "=================================================="

# Test 1: Check if backend is running
echo "1. Testing backend health..."
if curl -s http://localhost:8000/api/health > /dev/null; then
    echo "✅ Backend is running and healthy"
else
    echo "❌ Backend is not running or not accessible"
    echo "   Start it with: cd api && python -m uvicorn app:app --host 0.0.0.0 --port 8000"
fi

# Test 2: Check if frontend is running
echo "2. Testing frontend..."
if curl -s http://localhost:3000 > /dev/null; then
    echo "✅ Frontend is running"
else
    echo "❌ Frontend is not running"
    echo "   Start it with: cd frontend && npm start"
fi

# Test 3: Test API endpoints
echo "3. Testing API endpoints..."
if curl -s http://localhost:8000/api/test | grep -q "API is working"; then
    echo "✅ API test endpoint is working"
else
    echo "❌ API test endpoint is not working"
fi

# Test 4: Check Vercel configuration
echo "4. Checking Vercel configuration..."
if [ -f "vercel.json" ]; then
    echo "✅ Main vercel.json exists"
else
    echo "❌ Main vercel.json missing"
fi

if [ -f "api/vercel.json" ]; then
    echo "✅ API vercel.json exists"
else
    echo "❌ API vercel.json missing"
fi

echo ""
echo "🚀 Ready for deployment!"
echo "   Run: vercel --prod" 
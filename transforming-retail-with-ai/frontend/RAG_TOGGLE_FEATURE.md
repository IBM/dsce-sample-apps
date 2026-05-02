# RAG Intelligence Toggle Feature

## Overview
This document describes the RAG (Retrieval-Augmented Generation) Intelligence toggle feature that has been integrated into the retail application's product listing page.

## Feature Description
A modern, animated toggle button labeled "Integrate RAG Intelligence" has been added to the product catalog page. This toggle allows users to enable or disable AI-powered product insights powered by the FastAPI RAG server.

## Location
The toggle button is positioned in the **top-right area of the navigation bar**, appearing below the logout button when a user is logged in and viewing the catalog page (`/`).

## User Experience

### Toggle States
1. **OFF (Default)**: RAG API is not called; regular product insights are displayed
2. **ON**: RAG API is called to provide enhanced AI-powered insights

### Visual Feedback
When the toggle is switched ON, users see an animated loading sequence with the following stages:
1. **Preparing product documents...** (1.2s)
2. **Chunking data...** (1.2s)
3. **Embedding vectors...** (1.2s)
4. **Ready!** (0.8s)

The toggle features:
- Smooth sliding animation
- Color-coded states (gray=OFF, blue=ON, orange=processing)
- Progress bar showing completion percentage
- Animated spinner during processing
- Check/cross icons indicating state

## Technical Implementation

### Files Created/Modified

#### New Files
1. **`frontend/src/components/RAGToggle.jsx`**
   - React component for the toggle button
   - Manages processing animation states
   - Displays loading progress with messages

2. **`frontend/src/components/RAGToggle.css`**
   - Modern styling with smooth animations
   - Responsive design for mobile devices
   - Glassmorphic design with backdrop blur
   - Keyframe animations for spinner, shimmer, and fade effects

3. **`frontend/.env.example`**
   - Environment variable configuration template
   - Includes RAG API URL configuration

4. **`frontend/RAG_TOGGLE_FEATURE.md`** (this file)
   - Documentation for the feature

#### Modified Files
1. **`frontend/src/App.jsx`**
   - Added RAGToggle component import
   - Added `ragEnabled` state with localStorage persistence
   - Added `handleRagToggle` function
   - Updated Navbar to accept and display RAG toggle
   - Passed `ragEnabled` prop to ProductInsightsModal

2. **`frontend/src/App.css`**
   - Added `.nav-right-content` styling
   - Added `.rag-toggle-nav` positioning
   - Added slideDown animation

3. **`frontend/src/api.js`**
   - Updated `getProductInsights()` to accept `useRAG` parameter
   - Passes `useRAG` as query parameter to backend

4. **`frontend/src/components/ProductInsightsModal.jsx`**
   - Added `ragEnabled` prop
   - Passes `ragEnabled` to `getProductInsights()` function

5. **`backend/src/features_1_2_3_4_14.js`**
   - Added `useRAG` query parameter support
   - Conditional logic to call RAG API only when `useRAG=true`
   - Separate caching for RAG and non-RAG responses
   - Added `generateFallbackInsights()` for non-RAG mode

### State Management

#### Local State
- **Component**: `RAGToggle.jsx`
- **State**: `isProcessing`, `processingStep`
- **Purpose**: Manage animation sequence

#### Global State
- **Component**: `App.jsx`
- **State**: `ragEnabled` (boolean)
- **Persistence**: localStorage (`ragEnabled` key)
- **Default**: `false` (OFF)

### API Integration

#### RAG API Endpoint
- **URL**: Configured via `VITE_RAG_API_URL` environment variable
- **Default**: `http://localhost:8000`
- **Endpoint**: `/api/rag/query`
- **Method**: POST
- **Payload**: `{ query: string }`

#### Conditional Logic
The toggle state is passed from frontend to backend via query parameter:

**Frontend** (`ProductInsightsModal.jsx`):
```javascript
// Pass ragEnabled state to backend
const insightsData = await getProductInsights(productId, productName, ragEnabled);
```

**API Layer** (`api.js`):
```javascript
export async function getProductInsights(productId, productName = null, useRAG = false) {
  const params = {
    ...(productName && { name: productName }),
    useRAG: useRAG.toString()  // Pass toggle state to backend
  };
  const res = await api.get(`/products/${productId}/insights`, { params });
  return res.data;
}
```

**Backend** (`features_1_2_3_4_14.js`):
```javascript
const useRAG = req.query.useRAG === 'true';

if (useRAG) {
  // Call RAG /retrieve API
  const ragResults = await fetchProductInsightsFromRAG(productName);
  insights = transformRAGToInsights(ragResults, product);
} else {
  // Return fallback insights without calling RAG API
  insights = generateFallbackInsights(product);
}
```

## Configuration

### Environment Variables
Create a `.env` file in the `frontend/` directory:

```env
VITE_RAG_API_URL=http://localhost:8000
```

For production:
```env
VITE_RAG_API_URL=https://your-rag-api-domain.com
```

## Testing Instructions

### Manual Testing

1. **Start the application**
   ```bash
   cd frontend
   npm run dev
   ```

2. **Login to the application**
   - Navigate to `/login`
   - Use demo credentials

3. **Navigate to Catalog page** (`/`)

4. **Locate the RAG toggle**
   - Look in the top-right area, below the logout button
   - Should see "Integrate RAG Intelligence" label

5. **Test Toggle OFF → ON**
   - Click the toggle switch
   - Observe the animation sequence:
     - Toggle turns orange (processing)
     - Progress bar fills up
     - Messages change: "Preparing..." → "Chunking..." → "Embedding..." → "Ready!"
   - Toggle turns blue (enabled)
   - Toast notification: "RAG Intelligence enabled"

6. **Test Product Insights with RAG ON**
   - Click on any product card
   - Product insights modal should open
   - If RAG API is running, enhanced insights are displayed
   - If RAG API is not available, falls back to regular insights

7. **Test Toggle ON → OFF**
   - Click the toggle again
   - Toggle turns gray (disabled)
   - Toast notification: "RAG Intelligence disabled"

8. **Test Product Insights with RAG OFF**
   - Click on any product card
   - Regular insights are displayed (no RAG API call)

9. **Test Persistence**
   - Toggle RAG ON
   - Refresh the page
   - Toggle should remain ON (state persisted in localStorage)

### Automated Testing (Future)
- Unit tests for RAGToggle component
- Integration tests for API conditional logic
- E2E tests for user flow

## Browser Compatibility
- Chrome/Edge: ✅ Full support
- Firefox: ✅ Full support
- Safari: ✅ Full support (with webkit prefixes)
- Mobile browsers: ✅ Responsive design

## Performance Considerations
- Toggle state stored in localStorage (minimal overhead)
- Animation uses CSS transforms (GPU-accelerated)
- RAG API call only when toggle is ON
- Graceful fallback if RAG API fails

## Future Enhancements
1. Add analytics tracking for toggle usage
2. Add A/B testing for RAG vs non-RAG insights
3. Add user feedback mechanism
4. Add RAG response caching
5. Add toggle state sync across tabs
6. Add admin dashboard for RAG usage metrics

## Troubleshooting

### Toggle not visible
- Ensure you're logged in
- Ensure you're on the catalog page (`/`)
- Check browser console for errors

### RAG API not being called
- Verify `VITE_RAG_API_URL` is set correctly
- Check if RAG FastAPI server is running
- Check browser network tab for API calls
- Verify toggle is ON (blue color)

### Animation not smooth
- Check browser GPU acceleration settings
- Disable browser extensions that might interfere
- Try a different browser

### State not persisting
- Check browser localStorage is enabled
- Check for localStorage quota errors
- Clear browser cache and try again

## Support
For issues or questions, please contact the development team or create an issue in the project repository.

---
**Last Updated**: 2026-04-29
**Version**: 1.0.0
**Author**: Bob (AI Assistant)
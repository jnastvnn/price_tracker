# Price Tracker Client

A modern React application for tracking and searching product listings.

## Features

- 🔍 **Search Functionality**: Real-time search with server-side filtering
- 📄 **Pagination**: Efficient pagination for large datasets
- 📱 **Responsive Design**: Mobile-first responsive layout
- ⚡ **Fast Loading**: Optimized performance with loading states
- 🎨 **Modern UI**: Clean, modern interface with hover effects
- 🔄 **Error Handling**: Comprehensive error handling with retry options

## Tech Stack

- **React 18** - Modern React with hooks
- **Vite** - Fast build tool and development server
- **Axios** - HTTP client for API requests
- **Modern CSS** - CSS Grid, Flexbox, and custom properties
- **ESLint** - Code linting and formatting

## Getting Started

### Prerequisites

- Node.js (version 16 or higher)
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Open your browser and navigate to `http://localhost:5173`

### Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
VITE_API_URL=http://localhost:3001/api
VITE_NODE_ENV=development
```

See `src/config/env.example.js` for more details.

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── SearchBar.jsx   # Search input component
│   ├── ListingCard.jsx # Individual listing display
│   ├── LoadingSpinner.jsx # Loading state component
│   ├── ErrorMessage.jsx # Error display component
│   └── index.js        # Component exports
├── hooks/              # Custom React hooks
│   └── useListings.js  # Listings data management
├── services/           # API and external services
│   └── api.js          # API client and endpoints
├── config/             # Configuration files
│   └── env.example.js  # Environment configuration example
├── App.jsx             # Main application component
├── App.css             # Application styles
├── main.jsx            # Application entry point
└── index.css           # Global styles
```

## API Integration

The client communicates with the server API through:

- **GET /api/listings** - Fetch listings with pagination and search
- **GET /api/listings/:id** - Fetch individual listing details

The API client includes:
- Automatic request/response logging
- Error handling and retry logic
- Request timeout configuration
- Proxy configuration for development

## Styling

The application uses modern CSS features:
- CSS Grid for responsive layouts
- Custom properties for theming
- Smooth animations and transitions
- Mobile-first responsive design

## Development

### Code Style

- ESLint configuration for code quality
- Consistent component structure
- Modern JavaScript (ES6+)
- Functional components with hooks

### Performance Optimizations

- Debounced search input
- Pagination to limit data loading
- Optimized re-renders with React hooks
- Lazy loading for large datasets

## Building for Production

```bash
npm run build
```

The build artifacts will be stored in the `dist/` directory.

## Contributing

1. Follow the existing code style
2. Add tests for new features
3. Update documentation as needed
4. Ensure all linting passes

## License

This project is licensed under the MIT License.

# Epic Auto Video Machine API Documentation

## Overview

The Epic Auto Video Machine API provides endpoints for managing video generation projects, monitoring system health, and tracking usage metrics.

## Base URL

```
http://localhost:3000/api
```

## Authentication

Currently, the API operates without authentication for development purposes. Authentication will be added in future iterations.

## Response Format

All API responses follow a consistent format:

### Success Response

```json
{
  "success": true,
  "data": {
    // Response data
  },
  "meta": {
    "timestamp": "2025-08-14T12:00:00.000Z",
    "version": "1.0"
  }
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "details": {
      // Additional error details
    }
  },
  "meta": {
    "timestamp": "2025-08-14T12:00:00.000Z",
    "version": "1.0"
  }
}
```

## Endpoints

### Health Check

#### GET /api/health

Returns the health status of the API and its dependencies.

**Response:**

```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2025-08-14T12:00:00.000Z",
    "version": "1.0",
    "checks": {
      "api": true,
      "database": true,
      "timestamp": true,
      "metrics": {
        "recentFailureRate": 0,
        "recentAverageResponseTime": 0,
        "recentRequestCount": 0,
        "uptime": 12345
      }
    }
  }
}
```

### Metrics

#### GET /api/metrics

Returns API usage metrics and performance statistics.

**Response:**

```json
{
  "success": true,
  "data": {
    "totalRequests": 100,
    "successfulRequests": 95,
    "failedRequests": 5,
    "averageResponseTime": 150.5,
    "requestsByMethod": {
      "GET": 60,
      "POST": 30,
      "PUT": 8,
      "DELETE": 2
    },
    "requestsByStatus": {
      "200": 70,
      "201": 25,
      "400": 3,
      "404": 1,
      "500": 1
    },
    "requestsByPath": {
      "/api/v1/projects": 50,
      "/api/health": 30,
      "/api/metrics": 20
    },
    "uptime": 3600000,
    "startTime": 1755170000000,
    "health": {
      "status": "healthy",
      "details": {
        "recentFailureRate": 2.5,
        "recentAverageResponseTime": 145.2,
        "recentRequestCount": 40,
        "uptime": 3600000
      }
    }
  }
}
```

### Projects

#### GET /api/v1/projects

List all projects with pagination support.

**Query Parameters:**

- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20, max: 100)
- `status` (optional): Filter by status (`draft`, `ready`, `processing`, `completed`, `failed`)

**Response:**

```json
{
  "success": true,
  "data": {
    "projects": [
      {
        "id": "proj_1",
        "title": "My First Video",
        "description": "A test video project",
        "status": "draft",
        "config": {
          "aspect_ratio": "9:16",
          "template": "classic",
          "voice": "natural"
        },
        "created_at": "2025-08-14T12:00:00.000Z",
        "updated_at": "2025-08-14T12:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 1,
      "totalPages": 1,
      "hasNext": false,
      "hasPrev": false
    }
  }
}
```

#### POST /api/v1/projects

Create a new project.

**Request Body:**

```json
{
  "title": "My Video Project",
  "description": "Optional description",
  "config": {
    "aspect_ratio": "9:16",
    "template": "classic",
    "voice": "natural"
  }
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "proj_1755173737166",
    "title": "My Video Project",
    "description": "Optional description",
    "status": "draft",
    "config": {
      "aspect_ratio": "9:16",
      "template": "classic",
      "voice": "natural"
    },
    "created_at": "2025-08-14T12:00:00.000Z",
    "updated_at": "2025-08-14T12:00:00.000Z"
  }
}
```

#### GET /api/v1/projects/{id}

Get project details by ID.

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "proj_1",
    "title": "My First Video",
    "description": "A test video project",
    "status": "draft",
    "config": {
      "aspect_ratio": "9:16",
      "template": "classic",
      "voice": "natural"
    },
    "scenes": [],
    "created_at": "2025-08-14T12:00:00.000Z",
    "updated_at": "2025-08-14T12:00:00.000Z"
  }
}
```

#### PUT /api/v1/projects/{id}

Update project details.

**Request Body:**

```json
{
  "title": "Updated Title",
  "description": "Updated description",
  "config": {
    "aspect_ratio": "16:9",
    "template": "dark",
    "voice": "female"
  }
}
```

#### DELETE /api/v1/projects/{id}

Delete a project.

**Response:**

```json
{
  "success": true,
  "data": {
    "message": "Project deleted successfully"
  }
}
```

## Error Codes

| Code                     | Description                     |
| ------------------------ | ------------------------------- |
| `VALIDATION_ERROR`       | Request validation failed       |
| `INVALID_INPUT`          | Invalid input parameters        |
| `MISSING_REQUIRED_FIELD` | Required field is missing       |
| `UNAUTHORIZED`           | Authentication required         |
| `FORBIDDEN`              | Insufficient permissions        |
| `NOT_FOUND`              | Resource not found              |
| `ALREADY_EXISTS`         | Resource already exists         |
| `RATE_LIMIT_EXCEEDED`    | Rate limit exceeded             |
| `INTERNAL_ERROR`         | Internal server error           |
| `SERVICE_UNAVAILABLE`    | Service temporarily unavailable |
| `DATABASE_ERROR`         | Database operation failed       |
| `EXTERNAL_API_ERROR`     | External API error              |
| `GEMINI_API_ERROR`       | Gemini API specific error       |

## Rate Limiting

The API implements rate limiting to ensure fair usage:

- **General API**: 100 requests per 15 minutes per IP
- **Strict endpoints**: 10 requests per minute per IP
- **Generous endpoints**: 60 requests per minute per IP

When rate limit is exceeded, the API returns a `429 Too Many Requests` status with details about when to retry.

## Monitoring

The API includes built-in monitoring and metrics collection:

- Request/response logging
- Performance metrics
- Error tracking
- Health status monitoring
- Automatic cleanup of old metrics data

## CORS

All endpoints support CORS with the following configuration:

- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS`
- `Access-Control-Allow-Headers: Content-Type, Authorization`

## Development

To start the development server:

```bash
npm run dev
```

The API will be available at `http://localhost:3000/api`

## Testing

Test the API endpoints using curl:

```bash
# Health check
curl http://localhost:3000/api/health

# List projects
curl http://localhost:3000/api/v1/projects

# Create project
curl -X POST http://localhost:3000/api/v1/projects \
  -H "Content-Type: application/json" \
  -d '{"title": "Test Video", "description": "A test project"}'

# Get metrics
curl http://localhost:3000/api/metrics
```

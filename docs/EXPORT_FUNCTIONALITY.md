# Export Functionality Documentation

This document provides comprehensive documentation for the YouTube Outlier Discovery Tool's export functionality.

## Overview

The export system allows users to export analysis results in multiple formats with professional presentation quality. The system supports both immediate downloads for small datasets and background job processing for large exports.

## Supported Export Formats

### 1. Excel (.xlsx) - **Recommended**
- **Description**: Professional spreadsheet with multiple sheets, charts, and advanced formatting
- **Features**:
  - Executive Summary sheet with key insights
  - Detailed results with conditional formatting
  - Channel performance analysis
  - Interactive charts and visualizations
  - Data analysis with statistics
  - Strategic recommendations
  - Hyperlinks to YouTube videos and channels
  - Professional branding and styling

### 2. CSV (.csv)
- **Description**: Simple comma-separated values format for data analysis
- **Features**:
  - All core data fields
  - Compatible with Excel, Google Sheets, and data analysis tools
  - Lightweight and fast
  - Easy to import into databases

### 3. PDF (.pdf)
- **Description**: Formatted report for presentations and sharing
- **Features**:
  - Professional report layout
  - Summary statistics
  - Top outliers table
  - Suitable for executives and stakeholders
  - Print-ready format

### 4. JSON (.json)
- **Description**: Raw data format for developers and APIs
- **Features**:
  - Complete data structure
  - API-friendly format
  - Easy to parse programmatically
  - Includes metadata and configuration

### 5. HTML (.html)
- **Description**: Interactive web page with clickable links
- **Features**:
  - Responsive design
  - Clickable YouTube links
  - Sortable tables
  - Professional styling
  - Can be opened in any web browser

## API Endpoints

### Direct Export
```
GET /api/export/outlier/{analysis_id}/{format}
```
**Description**: Download analysis results directly in specified format

**Parameters**:
- `analysis_id`: UUID of the completed analysis
- `format`: Export format (excel, csv, pdf, json, html)

**Response**: File download with appropriate MIME type

**Example**:
```bash
curl -H "Authorization: Bearer <token>" \
     "https://api.example.com/api/export/outlier/123e4567-e89b-12d3-a456-426614174000/excel" \
     --output analysis_results.xlsx
```

### Batch Export
```
POST /api/export/batch
```
**Description**: Create batch export jobs for multiple analyses

**Request Body**:
```json
{
  "analysisIds": ["analysis-id-1", "analysis-id-2"],
  "format": "excel"
}
```

**Response**:
```json
{
  "success": true,
  "jobIds": ["job-id-1", "job-id-2"],
  "message": "Created 2 export jobs"
}
```

### Export Job Status
```
GET /api/export/job/{job_id}/status
```
**Description**: Get the status of a background export job

**Response**:
```json
{
  "success": true,
  "job": {
    "id": "job-id",
    "analysisId": "analysis-id",
    "format": "excel",
    "status": "completed",
    "progress": 100,
    "createdAt": "2023-12-07T10:30:00Z",
    "filename": "analysis_123_20231207.xlsx"
  }
}
```

### Download Export Job
```
GET /api/export/job/{job_id}/download
```
**Description**: Download completed export job file

**Response**: File download

### Export Formats List
```
GET /api/export/formats
```
**Description**: Get list of supported export formats

**Response**:
```json
{
  "success": true,
  "formats": ["excel", "csv", "pdf", "json", "html"],
  "descriptions": {
    "excel": "Microsoft Excel format with multiple sheets and charts",
    "csv": "Comma-separated values format",
    "pdf": "Portable Document Format with formatted report",
    "json": "JavaScript Object Notation format",
    "html": "HTML format with interactive table and styling"
  }
}
```

### User Analytics Export
```
GET /api/export/analytics/{format}
```
**Description**: Export user analytics and usage statistics

### Analysis History Export
```
GET /api/export/history?format={format}
```
**Description**: Export user's analysis history

## Frontend Components

### ExportManager Component
Comprehensive export interface with format selection and job tracking.

**Features**:
- Format selection with descriptions
- Background job support for large datasets
- Real-time progress tracking
- Download management
- Error handling

**Usage**:
```jsx
import ExportManager from './components/ExportManager';

<ExportManager
  analysisId="analysis-id"
  resultCount={150}
  onExportStart={() => console.log('Export started')}
  onExportComplete={(format) => console.log(`Export completed: ${format}`)}
/>
```

### ExportButton Component
Simple export button with dropdown format selection.

**Usage**:
```jsx
import ExportButton from './components/ui/ExportButton';

<ExportButton
  analysisId="analysis-id"
  resultCount={50}
  variant="dropdown" // or "button"
  size="md" // sm, md, lg
/>
```

### useExport Hook
React hook for managing export operations.

**Usage**:
```jsx
import { useExport } from './hooks/useExport';

const {
  isExporting,
  exportJobs,
  exportAnalysis,
  batchExport,
  downloadJob,
  getActiveJobs
} = useExport();

// Export analysis
const handleExport = async () => {
  await exportAnalysis({
    analysisId: 'analysis-id',
    format: 'excel',
    filename: 'custom-filename.xlsx'
  });
};
```

## Database Schema

### ExportJob Model
```sql
CREATE TABLE export_jobs (
    id VARCHAR(36) PRIMARY KEY,
    user_id INTEGER NOT NULL,
    analysis_id VARCHAR(36) NOT NULL,
    format VARCHAR(20) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    progress INTEGER DEFAULT 0,
    filename VARCHAR(255),
    file_path VARCHAR(500),
    file_size BIGINT,
    mime_type VARCHAR(100),
    export_config JSON,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    created_at TIMESTAMP DEFAULT NOW(),
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    expires_at TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### Job Status Values
- `pending`: Job created, waiting to be processed
- `processing`: Job is currently being processed
- `completed`: Job completed successfully
- `failed`: Job failed (can be retried if retry_count < max_retries)
- `cancelled`: Job was cancelled by user

## Background Processing

### Queue System
The export system uses a background queue for processing large exports:

- **Worker Threads**: Multiple worker threads process export jobs
- **Automatic Retry**: Failed jobs are automatically retried up to 3 times
- **Progress Tracking**: Real-time progress updates
- **File Cleanup**: Automatic cleanup of expired files

### Configuration
```python
# Number of worker threads
MAX_EXPORT_WORKERS = 3

# File expiration time (hours)
EXPORT_FILE_EXPIRATION = 24

# Maximum retries for failed jobs
MAX_EXPORT_RETRIES = 3

# Cleanup interval (hours)
CLEANUP_INTERVAL = 6
```

## Excel Export Features

### Multiple Worksheets
1. **Executive Summary**: Key metrics and insights
2. **Detailed Results**: Complete data with conditional formatting
3. **Channel Performance**: Channel-level analysis
4. **Analytics & Charts**: Visualizations and trends
5. **Recommendations**: Strategic recommendations
6. **Data Analysis**: Statistical analysis

### Advanced Excel Features
- **Conditional Formatting**: Color-coded performance indicators
- **Interactive Charts**: Scatter plots, bar charts, trend lines
- **Hyperlinks**: Direct links to YouTube videos and channels
- **Data Validation**: Dropdown lists and input validation
- **Professional Styling**: Corporate branding and consistent formatting
- **Formulas**: Calculated fields and dynamic metrics

### Business Intelligence Features
- **Performance Ratings**: Automated scoring (Excellent, Good, Fair, Poor)
- **Opportunity Scores**: Multi-factor opportunity assessment
- **Competition Analysis**: Market competition level assessment
- **Revenue Estimates**: Estimated revenue potential
- **Growth Metrics**: Channel growth potential analysis
- **Content Categorization**: Automatic content type classification

## Security Considerations

### Access Control
- Users can only export their own analyses
- Admin users can export any analysis
- JWT token authentication required
- Role-based access control (RBAC)

### File Security
- Temporary files are automatically cleaned up
- Files expire after 24 hours
- Secure file paths prevent directory traversal
- File size limits prevent abuse

### Rate Limiting
- Export quota per user per time period
- Background job limits
- API rate limiting

## Performance Optimization

### Caching
- Redis caching for job status
- Analysis data caching
- Frequent export format caching

### Streaming
- Large file streaming to avoid memory issues
- Chunked processing for big datasets
- Progressive file generation

### Compression
- File compression for downloads
- Gzip compression for API responses
- Optimized file formats

## Error Handling

### Common Errors
- **Analysis Not Found**: Analysis ID doesn't exist
- **Analysis Not Completed**: Cannot export incomplete analysis
- **Access Denied**: User doesn't have permission
- **Unsupported Format**: Invalid export format
- **Export Failed**: Technical error during generation
- **File Expired**: Export file has expired
- **Quota Exceeded**: User has exceeded export limits

### Error Response Format
```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {
    "field": "Additional error details"
  }
}
```

## Usage Examples

### Basic Export
```javascript
// Direct export
const response = await apiClient.get('/api/export/outlier/analysis-id/excel', {
  responseType: 'blob'
});

// Create download
const blob = new Blob([response.data]);
const url = window.URL.createObjectURL(blob);
const link = document.createElement('a');
link.href = url;
link.download = 'analysis_results.xlsx';
link.click();
```

### Background Export
```javascript
// Create export job
const jobResponse = await apiClient.post('/api/export/batch', {
  analysisIds: ['analysis-id'],
  format: 'excel'
});

const jobId = jobResponse.data.jobIds[0];

// Poll for completion
const checkStatus = async () => {
  const status = await apiClient.get(`/api/export/job/${jobId}/status`);
  
  if (status.data.job.status === 'completed') {
    // Download completed file
    window.location.href = `/api/export/job/${jobId}/download`;
  } else if (status.data.job.status === 'processing') {
    // Check again in 2 seconds
    setTimeout(checkStatus, 2000);
  }
};

checkStatus();
```

### React Component Integration
```jsx
function AnalysisResults({ analysisId, results }) {
  const { exportAnalysis, isExporting } = useSimpleExport();
  
  const handleExport = async (format) => {
    try {
      await exportAnalysis({
        analysisId,
        format,
        filename: `analysis_${analysisId}.${format}`
      });
    } catch (error) {
      console.error('Export failed:', error);
    }
  };
  
  return (
    <div>
      <h2>Analysis Results</h2>
      <ExportButton
        analysisId={analysisId}
        resultCount={results.length}
        variant="dropdown"
      />
      {/* Results display */}
    </div>
  );
}
```

## Installation and Setup

### Python Dependencies
```bash
pip install openpyxl reportlab pandas matplotlib seaborn jinja2
```

### Frontend Dependencies
```bash
npm install lucide-react
```

### Database Migration
```bash
# Run migration to create export_jobs table
python manage.py migrate
```

### Configuration
```python
# settings.py
EXPORT_SETTINGS = {
    'TEMP_DIR': '/tmp/exports',
    'MAX_WORKERS': 3,
    'FILE_EXPIRATION_HOURS': 24,
    'MAX_FILE_SIZE_MB': 100,
    'CLEANUP_INTERVAL_HOURS': 6
}
```

## Monitoring and Analytics

### Export Metrics
- Total exports per day/week/month
- Export format popularity
- Average export time
- Success/failure rates
- User export quotas
- File size statistics

### Health Checks
- Export queue health
- Worker thread status
- Disk space monitoring
- Export processing times

### Alerts
- Export job failures
- Queue backlog alerts
- Disk space warnings
- Performance degradation

## Future Enhancements

### Planned Features
- **PowerPoint Export**: Professional presentation format
- **Email Integration**: Send exports via email
- **Scheduled Exports**: Recurring export jobs
- **Custom Templates**: User-defined export templates
- **Data Filtering**: Export subsets of data
- **Compression Options**: ZIP archives for multiple files
- **Cloud Storage**: Integration with AWS S3, Google Drive
- **API Webhooks**: Notify external systems of completed exports

### Performance Improvements
- **Parallel Processing**: Multi-threaded export generation
- **Database Optimization**: Better indexing for job queries
- **CDN Integration**: Faster file downloads
- **Caching Layer**: Redis-based export caching

## Troubleshooting

### Common Issues

1. **Export Hangs**
   - Check worker thread status
   - Verify database connectivity
   - Check available disk space

2. **Large File Failures**
   - Increase memory limits
   - Enable background processing
   - Use streaming for large datasets

3. **Permission Errors**
   - Verify user authentication
   - Check analysis ownership
   - Validate RBAC permissions

4. **Format Errors**
   - Ensure all dependencies are installed
   - Check file format compatibility
   - Verify data integrity

### Debug Commands
```bash
# Check export queue status
curl -H "Authorization: Bearer <token>" /api/export/queue/status

# View recent export jobs
curl -H "Authorization: Bearer <token>" /api/export/jobs?limit=10

# Check export statistics
curl -H "Authorization: Bearer <token>" /api/export/stats
```

## Support

For technical support or feature requests related to export functionality:

1. Check this documentation first
2. Review error logs and status endpoints
3. Test with small datasets before large exports
4. Contact the development team with specific error details

---

*This documentation is part of the YouTube Outlier Discovery Tool project. Keep it updated as new features are added.*

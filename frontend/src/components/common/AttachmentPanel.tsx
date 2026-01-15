import React, { useState, useCallback, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  CircularProgress,
  Alert,
  Chip,
  Paper,
  Divider,
} from '@mui/material';
import {
  AttachFile as AttachFileIcon,
  CloudUpload as CloudUploadIcon,
  Download as DownloadIcon,
  Delete as DeleteIcon,
  InsertDriveFile as FileIcon,
  Image as ImageIcon,
  PictureAsPdf as PdfIcon,
  Description as DocIcon,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthProvider';
import { attachmentApi, AttachmentData } from '../../services/grcClient';

interface AttachmentPanelProps {
  refTable: string;
  refId: string;
  readOnly?: boolean;
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const getFileIcon = (contentType: string) => {
  if (contentType.startsWith('image/')) return <ImageIcon />;
  if (contentType === 'application/pdf') return <PdfIcon />;
  if (contentType.includes('word') || contentType.includes('document')) return <DocIcon />;
  return <FileIcon />;
};

const getStatusColor = (status: string): 'default' | 'success' | 'warning' | 'error' => {
  switch (status) {
    case 'scanned':
      return 'success';
    case 'blocked':
      return 'error';
    case 'deleted':
      return 'warning';
    default:
      return 'default';
  }
};

export const AttachmentPanel: React.FC<AttachmentPanelProps> = ({
  refTable,
  refId,
  readOnly = false,
}) => {
  const { user } = useAuth();
  const tenantId = user?.tenantId || '';

  const [attachments, setAttachments] = useState<AttachmentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const loadAttachments = useCallback(async () => {
    if (!tenantId || !refId) return;

    try {
      setLoading(true);
      setError(null);
      const data = await attachmentApi.list(tenantId, refTable, refId);
      setAttachments(data || []);
    } catch (err) {
      console.error('Failed to load attachments:', err);
      setError('Failed to load attachments');
      setAttachments([]);
    } finally {
      setLoading(false);
    }
  }, [tenantId, refTable, refId]);

  useEffect(() => {
    loadAttachments();
  }, [loadAttachments]);

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0 || !tenantId) return;

    setUploading(true);
    setError(null);

    try {
      for (let i = 0; i < files.length; i++) {
        await attachmentApi.upload(tenantId, refTable, refId, files[i]);
      }
      await loadAttachments();
    } catch (err) {
      console.error('Failed to upload file:', err);
      setError('Failed to upload file. Please check file type and size.');
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (attachment: AttachmentData) => {
    if (!tenantId) return;

    try {
      const blob = await attachmentApi.download(tenantId, attachment.id);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = attachment.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download file:', err);
      setError('Failed to download file');
    }
  };

  const handleDelete = async (attachment: AttachmentData) => {
    if (!tenantId) return;

    if (!window.confirm(`Are you sure you want to delete "${attachment.fileName}"?`)) {
      return;
    }

    try {
      await attachmentApi.delete(tenantId, attachment.id);
      await loadAttachments();
    } catch (err) {
      console.error('Failed to delete file:', err);
      setError('Failed to delete file');
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleUpload(e.dataTransfer.files);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleUpload(e.target.files);
    e.target.value = '';
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" p={3}>
        <CircularProgress size={24} />
        <Typography variant="body2" sx={{ ml: 2 }}>
          Loading attachments...
        </Typography>
      </Box>
    );
  }

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Box display="flex" alignItems="center" mb={2}>
        <AttachFileIcon sx={{ mr: 1 }} />
        <Typography variant="h6">Attachments</Typography>
        <Chip
          label={attachments.length}
          size="small"
          sx={{ ml: 1 }}
        />
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {!readOnly && (
        <Box
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          sx={{
            border: '2px dashed',
            borderColor: dragOver ? 'primary.main' : 'grey.300',
            borderRadius: 1,
            p: 3,
            mb: 2,
            textAlign: 'center',
            backgroundColor: dragOver ? 'action.hover' : 'transparent',
            transition: 'all 0.2s ease',
          }}
        >
          <CloudUploadIcon sx={{ fontSize: 40, color: 'grey.500', mb: 1 }} />
          <Typography variant="body2" color="textSecondary">
            Drag and drop files here, or
          </Typography>
          <Button
            component="label"
            variant="outlined"
            size="small"
            sx={{ mt: 1 }}
            disabled={uploading}
          >
            {uploading ? 'Uploading...' : 'Browse Files'}
            <input
              type="file"
              hidden
              multiple
              onChange={handleFileInputChange}
            />
          </Button>
          <Typography variant="caption" display="block" color="textSecondary" sx={{ mt: 1 }}>
            Max file size: 10MB. Allowed: PDF, Office, Images, Text, JSON, XML, ZIP
          </Typography>
        </Box>
      )}

      {attachments.length === 0 ? (
        <Typography variant="body2" color="textSecondary" textAlign="center" py={2}>
          No attachments yet
        </Typography>
      ) : (
        <>
          <Divider sx={{ mb: 1 }} />
          <List dense>
            {attachments.map((attachment) => (
              <ListItem key={attachment.id}>
                <ListItemIcon>
                  {getFileIcon(attachment.contentType)}
                </ListItemIcon>
                <ListItemText
                  primary={attachment.fileName}
                  secondary={
                    <Box component="span" display="flex" alignItems="center" gap={1}>
                      <span>{formatFileSize(attachment.sizeBytes)}</span>
                      {attachment.status !== 'uploaded' && (
                        <Chip
                          label={attachment.status}
                          size="small"
                          color={getStatusColor(attachment.status)}
                        />
                      )}
                    </Box>
                  }
                />
                <ListItemSecondaryAction>
                  <IconButton
                    edge="end"
                    aria-label="download"
                    onClick={() => handleDownload(attachment)}
                    disabled={attachment.status === 'blocked'}
                    size="small"
                  >
                    <DownloadIcon />
                  </IconButton>
                  {!readOnly && (
                    <IconButton
                      edge="end"
                      aria-label="delete"
                      onClick={() => handleDelete(attachment)}
                      size="small"
                      sx={{ ml: 1 }}
                    >
                      <DeleteIcon />
                    </IconButton>
                  )}
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        </>
      )}
    </Paper>
  );
};

export default AttachmentPanel;

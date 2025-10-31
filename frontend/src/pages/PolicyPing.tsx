import React from 'react';
import { Button, CircularProgress, Stack, Typography } from '@mui/material';
import { api } from '../lib/api';

export function PolicyPing() {
  const [loading, setLoading] = React.useState(false);
  const [result, setResult] = React.useState<string>('');
  const [error, setError] = React.useState<string>('');

  const ping = async () => {
    setLoading(true);
    setResult('');
    setError('');
    try {
      const res = await api.get('/v2/policies');
      setResult(JSON.stringify(res.data));
    } catch (e: any) {
      setError(e?.message || 'Request failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Stack spacing={2}>
      <Typography variant="h6">Policy API Ping</Typography>
      <Button variant="contained" onClick={ping} disabled={loading}>
        {loading ? <CircularProgress size={20} /> : 'GET /api/v2/policies'}
      </Button>
      {result && <Typography variant="body2">{result}</Typography>}
      {error && <Typography color="error" variant="body2">{error}</Typography>}
    </Stack>
  );
}



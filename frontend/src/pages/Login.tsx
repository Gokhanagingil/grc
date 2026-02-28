import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  TextField,
  Button,
  Typography,
  Alert,
  Container,
  Paper,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';

export const Login: React.FC = () => {
  const [loginData, setLoginData] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation('common');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await login(loginData.username, loginData.password);
      navigate('/dashboard');
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Login failed';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container component="main" maxWidth="sm">
      <Box
        sx={{
          marginTop: 8,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <Paper elevation={3} sx={{ width: '100%' }}>
          <Box component="form" onSubmit={handleLogin} sx={{ p: 3 }} data-testid="form-login">
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 1.5, mb: 2 }}>
              <Box
                component="img"
                src="/brand/niles-icon.svg"
                alt="NILES"
                sx={{ width: 36, height: 36 }}
              />
              <Typography 
                variant="h5" 
                sx={{ 
                  fontWeight: 600, 
                  color: 'primary.main',
                  letterSpacing: '0.02em',
                }}
              >
                {t('login.title')}
              </Typography>
            </Box>
            <Typography component="h1" variant="h6" align="center" gutterBottom data-testid="page-login-title" sx={{ color: 'text.secondary' }}>
              {t('login.subtitle')}
            </Typography>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            <TextField
              margin="normal"
              required
              fullWidth
              id="username"
              label={t('login.username')}
              name="username"
              autoComplete="username"
              autoFocus
              value={loginData.username}
              onChange={(e) => setLoginData({ ...loginData, username: e.target.value })}
              inputProps={{ 'data-testid': 'input-username' }}
            />
            <TextField
              margin="normal"
              required
              fullWidth
              name="password"
              label={t('login.password')}
              type="password"
              id="password"
              autoComplete="current-password"
              value={loginData.password}
              onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
              inputProps={{ 'data-testid': 'input-password' }}
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{ mt: 3, mb: 2 }}
              disabled={loading}
              data-testid="button-login"
            >
              {loading ? t('login.signingIn') : t('login.signIn')}
            </Button>
            <Typography variant="body2" color="text.secondary" align="center" sx={{ mt: 2 }}>
              {t('login.needAccount')}
            </Typography>
          </Box>
        </Paper>
      </Box>
    </Container>
  );
};

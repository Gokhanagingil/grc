import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Avatar,
  Chip,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  SelectChangeEvent,
} from '@mui/material';
import {
  Person as PersonIcon,
  Email as EmailIcon,
  Business as DepartmentIcon,
  Badge as RoleIcon,
  Domain as TenantIcon,
  Language as LanguageIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';
import { SUPPORTED_LOCALES, DEFAULT_LOCALE } from '../i18n/config';

export const Profile: React.FC = () => {
  const { user } = useAuth();
  const { t, i18n } = useTranslation('common');
  const [localeSaving, setLocaleSaving] = useState(false);
  const [localeMessage, setLocaleMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleLocaleChange = async (event: SelectChangeEvent<string>) => {
    const newLocale = event.target.value;
    const previousLocale = i18n.language;
    setLocaleSaving(true);
    setLocaleMessage(null);

    // Apply immediately in the UI (optimistic update)
    i18n.changeLanguage(newLocale);
    localStorage.setItem('locale', newLocale);

    try {
      // Persist to backend
      if (user?.id) {
        await api.patch(`/users/me/locale`, { locale: newLocale });
      }
      setLocaleMessage({ type: 'success', text: t('profile.localeSaved') });
    } catch (err) {
      console.error('Failed to save locale:', err);
      // Rollback to previous locale on failure
      i18n.changeLanguage(previousLocale);
      localStorage.setItem('locale', previousLocale);
      setLocaleMessage({ type: 'error', text: t('profile.localeError') });
    } finally {
      setLocaleSaving(false);
      // Auto-dismiss success message after 3s
      setTimeout(() => setLocaleMessage(null), 3000);
    }
  };

  const getRoleColor = (role: string): 'error' | 'warning' | 'default' => {
    switch (role) {
      case 'admin':
        return 'error';
      case 'manager':
        return 'warning';
      default:
        return 'default';
    }
  };

  if (!user) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <Typography color="textSecondary">{t('profile.loading')}</Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        {t('profile.title')}
      </Typography>

      <Card sx={{ maxWidth: 600, mt: 3 }}>
        <CardContent>
          <Box display="flex" alignItems="center" mb={3}>
            <Avatar
              sx={{
                width: 80,
                height: 80,
                fontSize: '2rem',
                bgcolor: 'primary.main',
                mr: 3,
              }}
            >
              {user.firstName?.[0]}{user.lastName?.[0]}
            </Avatar>
            <Box>
              <Typography variant="h5">
                {user.firstName} {user.lastName}
              </Typography>
              <Chip
                label={user.role?.toUpperCase()}
                color={getRoleColor(user.role)}
                size="small"
                sx={{ mt: 1, fontWeight: 'bold' }}
              />
            </Box>
          </Box>

          <Divider sx={{ my: 2 }} />

          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Box display="flex" alignItems="center" gap={2}>
                <PersonIcon color="action" />
                <Box>
                  <Typography variant="caption" color="textSecondary">
                    {t('profile.username')}
                  </Typography>
                  <Typography variant="body1">
                    {user.username || '-'}
                  </Typography>
                </Box>
              </Box>
            </Grid>

            <Grid item xs={12}>
              <Box display="flex" alignItems="center" gap={2}>
                <EmailIcon color="action" />
                <Box>
                  <Typography variant="caption" color="textSecondary">
                    {t('profile.email')}
                  </Typography>
                  <Typography variant="body1">
                    {user.email || '-'}
                  </Typography>
                </Box>
              </Box>
            </Grid>

            <Grid item xs={12}>
              <Box display="flex" alignItems="center" gap={2}>
                <RoleIcon color="action" />
                <Box>
                  <Typography variant="caption" color="textSecondary">
                    {t('profile.role')}
                  </Typography>
                  <Typography variant="body1">
                    {user.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : '-'}
                  </Typography>
                </Box>
              </Box>
            </Grid>

            <Grid item xs={12}>
              <Box display="flex" alignItems="center" gap={2}>
                <DepartmentIcon color="action" />
                <Box>
                  <Typography variant="caption" color="textSecondary">
                    {t('profile.department')}
                  </Typography>
                  <Typography variant="body1">
                    {user.department || '-'}
                  </Typography>
                </Box>
              </Box>
            </Grid>

            <Grid item xs={12}>
              <Box display="flex" alignItems="center" gap={2}>
                <TenantIcon color="action" />
                <Box>
                  <Typography variant="caption" color="textSecondary">
                    {t('profile.tenantId')}
                  </Typography>
                  <Typography variant="body1" sx={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>
                    {user.tenantId || '-'}
                  </Typography>
                </Box>
              </Box>
            </Grid>

            <Grid item xs={12}>
              <Divider sx={{ my: 1 }} />
              <Box display="flex" alignItems="flex-start" gap={2} mt={2}>
                <LanguageIcon color="action" sx={{ mt: 1 }} />
                <Box sx={{ flex: 1 }}>
                  <Typography variant="caption" color="textSecondary">
                    {t('profile.languageLabel')}
                  </Typography>
                  <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
                    {t('profile.languageDescription')}
                  </Typography>
                  <FormControl size="small" sx={{ minWidth: 220 }}>
                    <InputLabel id="locale-select-label">{t('profile.language')}</InputLabel>
                    <Select
                      labelId="locale-select-label"
                      id="locale-select"
                      value={i18n.language || user.locale || DEFAULT_LOCALE}
                      label={t('profile.language')}
                      onChange={handleLocaleChange}
                      disabled={localeSaving}
                      data-testid="locale-select"
                    >
                      {SUPPORTED_LOCALES.map((loc) => (
                        <MenuItem key={loc.code} value={loc.code}>
                          {loc.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  {localeMessage && (
                    <Alert severity={localeMessage.type} sx={{ mt: 1 }}>
                      {localeMessage.text}
                    </Alert>
                  )}
                </Box>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    </Box>
  );
};

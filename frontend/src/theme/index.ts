import { createTheme, ThemeOptions } from '@mui/material/styles';

/**
 * Enterprise Theme for GRC Platform
 * 
 * Design Principles:
 * - Professional, corporate aesthetic
 * - Neutral-driven palette with restrained primary accent
 * - WCAG AA compliant contrast ratios
 * - Consistent spacing and typography scale
 * - No flashy gradients - enterprise SaaS feel
 */

// Color Palette - Corporate neutral-driven with professional accents
const colors = {
  // Primary - Deep slate blue for professionalism
  primary: {
    main: '#1e3a5f',
    light: '#2d5a8a',
    dark: '#0f1f33',
    contrastText: '#ffffff',
  },
  // Secondary - Muted teal for actions and accents
  secondary: {
    main: '#0d7377',
    light: '#14a3a8',
    dark: '#094b4d',
    contrastText: '#ffffff',
  },
  // Error - Accessible red
  error: {
    main: '#c62828',
    light: '#ef5350',
    dark: '#8e0000',
    contrastText: '#ffffff',
  },
  // Warning - Accessible amber
  warning: {
    main: '#e65100',
    light: '#ff833a',
    dark: '#ac1900',
    contrastText: '#ffffff',
  },
  // Info - Professional blue
  info: {
    main: '#0277bd',
    light: '#58a5f0',
    dark: '#004c8c',
    contrastText: '#ffffff',
  },
  // Success - Accessible green
  success: {
    main: '#2e7d32',
    light: '#60ad5e',
    dark: '#005005',
    contrastText: '#ffffff',
  },
  // Neutral grays
  grey: {
    50: '#fafafa',
    100: '#f5f5f5',
    200: '#eeeeee',
    300: '#e0e0e0',
    400: '#bdbdbd',
    500: '#9e9e9e',
    600: '#757575',
    700: '#616161',
    800: '#424242',
    900: '#212121',
  },
  // Background colors
  background: {
    default: '#f8f9fa',
    paper: '#ffffff',
  },
  // Text colors
  text: {
    primary: '#1a1a2e',
    secondary: '#4a4a68',
    disabled: '#9e9e9e',
  },
  // Divider
  divider: 'rgba(0, 0, 0, 0.08)',
};

// Typography - Inter font with professional scale
const typography = {
  fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  // Page titles
  h1: {
    fontSize: '2.25rem',
    fontWeight: 600,
    lineHeight: 1.2,
    letterSpacing: '-0.01em',
  },
  h2: {
    fontSize: '1.875rem',
    fontWeight: 600,
    lineHeight: 1.25,
    letterSpacing: '-0.01em',
  },
  h3: {
    fontSize: '1.5rem',
    fontWeight: 600,
    lineHeight: 1.3,
    letterSpacing: '-0.005em',
  },
  // Section headings
  h4: {
    fontSize: '1.25rem',
    fontWeight: 600,
    lineHeight: 1.35,
    letterSpacing: '0',
  },
  h5: {
    fontSize: '1.125rem',
    fontWeight: 600,
    lineHeight: 1.4,
    letterSpacing: '0',
  },
  h6: {
    fontSize: '1rem',
    fontWeight: 600,
    lineHeight: 1.45,
    letterSpacing: '0',
  },
  // Body text
  body1: {
    fontSize: '0.9375rem',
    fontWeight: 400,
    lineHeight: 1.6,
    letterSpacing: '0',
  },
  // Table text / secondary body
  body2: {
    fontSize: '0.875rem',
    fontWeight: 400,
    lineHeight: 1.5,
    letterSpacing: '0',
  },
  // Subtitles
  subtitle1: {
    fontSize: '1rem',
    fontWeight: 500,
    lineHeight: 1.5,
    letterSpacing: '0',
  },
  subtitle2: {
    fontSize: '0.875rem',
    fontWeight: 500,
    lineHeight: 1.5,
    letterSpacing: '0',
  },
  // Helper text / captions
  caption: {
    fontSize: '0.75rem',
    fontWeight: 400,
    lineHeight: 1.5,
    letterSpacing: '0.01em',
  },
  // Overline
  overline: {
    fontSize: '0.6875rem',
    fontWeight: 600,
    lineHeight: 1.5,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
  },
  // Buttons
  button: {
    fontSize: '0.875rem',
    fontWeight: 500,
    lineHeight: 1.5,
    letterSpacing: '0.02em',
    textTransform: 'none' as const,
  },
};

// Spacing scale (base 8px)
const spacing = 8;

// Shape - Border radius
const shape = {
  borderRadius: 6,
};

// Shadows - Subtle, professional
const shadows = [
  'none',
  '0px 1px 2px rgba(0, 0, 0, 0.04)',
  '0px 1px 3px rgba(0, 0, 0, 0.06)',
  '0px 2px 4px rgba(0, 0, 0, 0.06)',
  '0px 2px 6px rgba(0, 0, 0, 0.08)',
  '0px 3px 8px rgba(0, 0, 0, 0.08)',
  '0px 4px 12px rgba(0, 0, 0, 0.1)',
  '0px 5px 14px rgba(0, 0, 0, 0.1)',
  '0px 6px 16px rgba(0, 0, 0, 0.12)',
  '0px 8px 20px rgba(0, 0, 0, 0.12)',
  '0px 10px 24px rgba(0, 0, 0, 0.14)',
  '0px 12px 28px rgba(0, 0, 0, 0.14)',
  '0px 14px 32px rgba(0, 0, 0, 0.16)',
  '0px 16px 36px rgba(0, 0, 0, 0.16)',
  '0px 18px 40px rgba(0, 0, 0, 0.18)',
  '0px 20px 44px rgba(0, 0, 0, 0.18)',
  '0px 22px 48px rgba(0, 0, 0, 0.2)',
  '0px 24px 52px rgba(0, 0, 0, 0.2)',
  '0px 26px 56px rgba(0, 0, 0, 0.22)',
  '0px 28px 60px rgba(0, 0, 0, 0.22)',
  '0px 30px 64px rgba(0, 0, 0, 0.24)',
  '0px 32px 68px rgba(0, 0, 0, 0.24)',
  '0px 34px 72px rgba(0, 0, 0, 0.26)',
  '0px 36px 76px rgba(0, 0, 0, 0.26)',
  '0px 38px 80px rgba(0, 0, 0, 0.28)',
] as ThemeOptions['shadows'];

// Component overrides for consistent styling
const components: ThemeOptions['components'] = {
  MuiCssBaseline: {
    styleOverrides: {
      body: {
        scrollbarWidth: 'thin',
        '&::-webkit-scrollbar': {
          width: '8px',
          height: '8px',
        },
        '&::-webkit-scrollbar-track': {
          background: colors.grey[100],
        },
        '&::-webkit-scrollbar-thumb': {
          background: colors.grey[400],
          borderRadius: '4px',
        },
        '&::-webkit-scrollbar-thumb:hover': {
          background: colors.grey[500],
        },
      },
    },
  },
  MuiButton: {
    styleOverrides: {
      root: {
        borderRadius: 6,
        padding: '8px 16px',
        fontWeight: 500,
        boxShadow: 'none',
        '&:hover': {
          boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
        },
      },
      contained: {
        '&:hover': {
          boxShadow: '0px 2px 6px rgba(0, 0, 0, 0.15)',
        },
      },
      outlined: {
        borderWidth: '1.5px',
        '&:hover': {
          borderWidth: '1.5px',
        },
      },
      sizeSmall: {
        padding: '4px 12px',
        fontSize: '0.8125rem',
      },
      sizeLarge: {
        padding: '12px 24px',
        fontSize: '0.9375rem',
      },
    },
    defaultProps: {
      disableElevation: true,
    },
  },
  MuiIconButton: {
    styleOverrides: {
      root: {
        borderRadius: 6,
        '&:hover': {
          backgroundColor: 'rgba(0, 0, 0, 0.04)',
        },
      },
    },
  },
  MuiCard: {
    styleOverrides: {
      root: {
        borderRadius: 8,
        boxShadow: '0px 1px 3px rgba(0, 0, 0, 0.06)',
        border: `1px solid ${colors.divider}`,
      },
    },
  },
  MuiCardContent: {
    styleOverrides: {
      root: {
        padding: 20,
        '&:last-child': {
          paddingBottom: 20,
        },
      },
    },
  },
  MuiPaper: {
    styleOverrides: {
      root: {
        backgroundImage: 'none',
      },
      rounded: {
        borderRadius: 8,
      },
      elevation1: {
        boxShadow: '0px 1px 3px rgba(0, 0, 0, 0.06)',
      },
    },
  },
  MuiChip: {
    styleOverrides: {
      root: {
        borderRadius: 6,
        fontWeight: 500,
        fontSize: '0.75rem',
      },
      sizeSmall: {
        height: 24,
        fontSize: '0.6875rem',
      },
      filled: {
        backgroundColor: colors.grey[100],
        color: colors.text.primary,
      },
      colorPrimary: {
        backgroundColor: `${colors.primary.main}14`,
        color: colors.primary.main,
      },
      colorSecondary: {
        backgroundColor: `${colors.secondary.main}14`,
        color: colors.secondary.main,
      },
      colorSuccess: {
        backgroundColor: `${colors.success.main}14`,
        color: colors.success.main,
      },
      colorError: {
        backgroundColor: `${colors.error.main}14`,
        color: colors.error.main,
      },
      colorWarning: {
        backgroundColor: `${colors.warning.main}14`,
        color: colors.warning.dark,
      },
      colorInfo: {
        backgroundColor: `${colors.info.main}14`,
        color: colors.info.main,
      },
    },
  },
  MuiTextField: {
    styleOverrides: {
      root: {
        '& .MuiOutlinedInput-root': {
          borderRadius: 6,
          '& fieldset': {
            borderColor: colors.grey[300],
          },
          '&:hover fieldset': {
            borderColor: colors.grey[400],
          },
          '&.Mui-focused fieldset': {
            borderColor: colors.primary.main,
            borderWidth: '1.5px',
          },
        },
      },
    },
  },
  MuiOutlinedInput: {
    styleOverrides: {
      root: {
        borderRadius: 6,
        '& fieldset': {
          borderColor: colors.grey[300],
        },
        '&:hover fieldset': {
          borderColor: colors.grey[400],
        },
        '&.Mui-focused fieldset': {
          borderColor: colors.primary.main,
          borderWidth: '1.5px',
        },
      },
      input: {
        padding: '10px 14px',
      },
      inputSizeSmall: {
        padding: '8px 12px',
      },
    },
  },
  MuiSelect: {
    styleOverrides: {
      root: {
        borderRadius: 6,
      },
    },
  },
  MuiInputLabel: {
    styleOverrides: {
      root: {
        fontSize: '0.875rem',
        fontWeight: 500,
        color: colors.text.secondary,
        '&.Mui-focused': {
          color: colors.primary.main,
        },
      },
    },
  },
  MuiTable: {
    styleOverrides: {
      root: {
        borderCollapse: 'separate',
        borderSpacing: 0,
      },
    },
  },
  MuiTableHead: {
    styleOverrides: {
      root: {
        '& .MuiTableCell-head': {
          backgroundColor: colors.grey[50],
          fontWeight: 600,
          fontSize: '0.75rem',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: colors.text.secondary,
          borderBottom: `1px solid ${colors.grey[200]}`,
          padding: '12px 16px',
        },
      },
    },
  },
  MuiTableBody: {
    styleOverrides: {
      root: {
        '& .MuiTableRow-root': {
          '&:hover': {
            backgroundColor: colors.grey[50],
          },
          '&:last-child .MuiTableCell-body': {
            borderBottom: 'none',
          },
        },
      },
    },
  },
  MuiTableCell: {
    styleOverrides: {
      root: {
        borderBottom: `1px solid ${colors.grey[100]}`,
        padding: '12px 16px',
        fontSize: '0.875rem',
      },
      head: {
        fontWeight: 600,
      },
    },
  },
  MuiTableRow: {
    styleOverrides: {
      root: {
        '&.MuiTableRow-hover:hover': {
          backgroundColor: colors.grey[50],
          cursor: 'pointer',
        },
      },
    },
  },
  MuiDialog: {
    styleOverrides: {
      paper: {
        borderRadius: 12,
        boxShadow: '0px 8px 32px rgba(0, 0, 0, 0.12)',
      },
    },
  },
  MuiDialogTitle: {
    styleOverrides: {
      root: {
        fontSize: '1.125rem',
        fontWeight: 600,
        padding: '20px 24px 16px',
      },
    },
  },
  MuiDialogContent: {
    styleOverrides: {
      root: {
        padding: '8px 24px 20px',
      },
    },
  },
  MuiDialogActions: {
    styleOverrides: {
      root: {
        padding: '12px 24px 20px',
        gap: 8,
      },
    },
  },
  MuiAlert: {
    styleOverrides: {
      root: {
        borderRadius: 8,
        fontSize: '0.875rem',
      },
      standardSuccess: {
        backgroundColor: `${colors.success.main}0a`,
        color: colors.success.dark,
        '& .MuiAlert-icon': {
          color: colors.success.main,
        },
      },
      standardError: {
        backgroundColor: `${colors.error.main}0a`,
        color: colors.error.dark,
        '& .MuiAlert-icon': {
          color: colors.error.main,
        },
      },
      standardWarning: {
        backgroundColor: `${colors.warning.main}0a`,
        color: colors.warning.dark,
        '& .MuiAlert-icon': {
          color: colors.warning.main,
        },
      },
      standardInfo: {
        backgroundColor: `${colors.info.main}0a`,
        color: colors.info.dark,
        '& .MuiAlert-icon': {
          color: colors.info.main,
        },
      },
    },
  },
  MuiTooltip: {
    styleOverrides: {
      tooltip: {
        backgroundColor: colors.grey[800],
        fontSize: '0.75rem',
        fontWeight: 500,
        padding: '6px 12px',
        borderRadius: 4,
      },
      arrow: {
        color: colors.grey[800],
      },
    },
  },
  MuiMenu: {
    styleOverrides: {
      paper: {
        borderRadius: 8,
        boxShadow: '0px 4px 16px rgba(0, 0, 0, 0.12)',
        border: `1px solid ${colors.divider}`,
      },
    },
  },
  MuiMenuItem: {
    styleOverrides: {
      root: {
        fontSize: '0.875rem',
        padding: '10px 16px',
        '&:hover': {
          backgroundColor: colors.grey[50],
        },
        '&.Mui-selected': {
          backgroundColor: `${colors.primary.main}0a`,
          '&:hover': {
            backgroundColor: `${colors.primary.main}14`,
          },
        },
      },
    },
  },
  MuiListItemButton: {
    styleOverrides: {
      root: {
        borderRadius: 6,
        '&.Mui-selected': {
          backgroundColor: colors.primary.main,
          color: '#ffffff',
          '&:hover': {
            backgroundColor: colors.primary.dark,
          },
          '& .MuiListItemIcon-root': {
            color: '#ffffff',
          },
          '& .MuiListItemText-primary': {
            fontWeight: 500,
          },
        },
      },
    },
  },
  MuiListItemIcon: {
    styleOverrides: {
      root: {
        minWidth: 40,
        color: colors.text.secondary,
      },
    },
  },
  MuiDrawer: {
    styleOverrides: {
      paper: {
        borderRight: `1px solid ${colors.divider}`,
        backgroundColor: colors.background.paper,
      },
    },
  },
  MuiAppBar: {
    styleOverrides: {
      root: {
        boxShadow: '0px 1px 3px rgba(0, 0, 0, 0.06)',
      },
      colorPrimary: {
        backgroundColor: colors.primary.main,
      },
    },
  },
  MuiBreadcrumbs: {
    styleOverrides: {
      root: {
        fontSize: '0.8125rem',
      },
      separator: {
        marginLeft: 4,
        marginRight: 4,
      },
    },
  },
  MuiTabs: {
    styleOverrides: {
      root: {
        minHeight: 44,
      },
      indicator: {
        height: 3,
        borderRadius: '3px 3px 0 0',
      },
    },
  },
  MuiTab: {
    styleOverrides: {
      root: {
        textTransform: 'none',
        fontWeight: 500,
        fontSize: '0.875rem',
        minHeight: 44,
        padding: '12px 16px',
        '&.Mui-selected': {
          fontWeight: 600,
        },
      },
    },
  },
  MuiDivider: {
    styleOverrides: {
      root: {
        borderColor: colors.divider,
      },
    },
  },
  MuiAvatar: {
    styleOverrides: {
      root: {
        fontSize: '0.875rem',
        fontWeight: 600,
      },
      colorDefault: {
        backgroundColor: colors.primary.main,
        color: '#ffffff',
      },
    },
  },
  MuiLinearProgress: {
    styleOverrides: {
      root: {
        borderRadius: 4,
        height: 6,
        backgroundColor: colors.grey[200],
      },
    },
  },
  MuiCircularProgress: {
    styleOverrides: {
      root: {
        color: colors.primary.main,
      },
    },
  },
  MuiSkeleton: {
    styleOverrides: {
      root: {
        backgroundColor: colors.grey[200],
      },
      rounded: {
        borderRadius: 6,
      },
    },
  },
  MuiTablePagination: {
    styleOverrides: {
      root: {
        borderTop: `1px solid ${colors.grey[100]}`,
      },
      selectLabel: {
        fontSize: '0.8125rem',
      },
      displayedRows: {
        fontSize: '0.8125rem',
      },
    },
  },
};

// Create the enterprise theme
const themeOptions: ThemeOptions = {
  palette: {
    mode: 'light',
    ...colors,
  },
  typography,
  spacing,
  shape,
  shadows,
  components,
};

export const enterpriseTheme = createTheme(themeOptions);

// Export color tokens for use in custom components
export const themeColors = colors;

// Export typography tokens
export const themeTypography = typography;

export default enterpriseTheme;

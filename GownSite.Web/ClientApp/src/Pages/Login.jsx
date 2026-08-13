import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Container, TextField, Button, Typography, Alert, Stack, IconButton, InputAdornment } from '@mui/material';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import { useAuth } from '../context/AuthContext';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const { login } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    const onLoginClick = async () => {
        setError('');
        try {
            await login(email, password);
            navigate(searchParams.get('redirect') || '/');
        } catch (err) {
            setError(err?.response?.data?.message || 'Login failed. Please check your email and password.');
        }
    };

    return (
        <Container maxWidth="xs" sx={{ py: 6 }}>
            <Typography variant="h4" gutterBottom>Log In</Typography>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            <Stack spacing={2}>
                <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} fullWidth />
                <TextField
                    label="Password" type={showPassword ? 'text' : 'password'} value={password}
                    onChange={(e) => setPassword(e.target.value)} fullWidth
                    slotProps={{
                        input: {
                            endAdornment: (
                                <InputAdornment position="end">
                                    <IconButton onClick={() => setShowPassword((v) => !v)} edge="end" size="small">
                                        {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                                    </IconButton>
                                </InputAdornment>
                            )
                        }
                    }}
                />
                <Button variant="contained" size="large" onClick={onLoginClick}>Log In</Button>
                <Typography variant="body2" color="text.secondary">
                    Don't have an account? <Link to="/signup">Create one</Link>
                </Typography>
            </Stack>
        </Container>
    );
};

export default Login;

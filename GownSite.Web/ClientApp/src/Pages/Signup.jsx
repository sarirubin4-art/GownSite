import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Container, TextField, Button, Typography, Alert, Stack, IconButton, InputAdornment } from '@mui/material';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import { useAuth } from '../context/AuthContext';

const Signup = () => {
    const [name, setName] = useState('');
    const [number, setNumber] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const { signup } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    const onSignupClick = async () => {
        setError('');
        if (!name.trim() || !number.trim() || !email.trim() || !password) {
            setError('Name, email, phone number, and password are required.');
            return;
        }
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
            setError('Please enter a valid email address.');
            return;
        }
        if ((number.match(/\d/g) || []).length < 10) {
            setError('Please enter a valid phone number.');
            return;
        }
        try {
            await signup(name, number, email, password);
            navigate(searchParams.get('redirect') || '/');
        } catch (err) {
            setError(err?.response?.data?.message || 'Could not create your account.');
        }
    };

    return (
        <Container maxWidth="xs" sx={{ py: 6 }}>
            <Typography variant="h4" gutterBottom>Create Account</Typography>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            <Stack spacing={2}>
                <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} fullWidth />
                <TextField label="Phone Number" value={number} onChange={(e) => setNumber(e.target.value)} fullWidth />
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
                <Button variant="contained" size="large" onClick={onSignupClick}>Create Account</Button>
                <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
                    By creating an account, you agree to our <Link to="/terms">Terms of Service</Link> and{' '}
                    <Link to="/privacy">Privacy Policy</Link>.
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    Already have an account? <Link to="/login">Log in</Link>
                </Typography>
            </Stack>
        </Container>
    );
};

export default Signup;

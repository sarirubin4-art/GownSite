import React from 'react';
import { Container, Typography, Paper, List, ListItem, ListItemText } from '@mui/material';
import usePageTitle from '../hooks/usePageTitle';

const Section = ({ title, children }) => (
    <>
        <Typography variant="h6" sx={{ mt: 4, mb: 1 }}>{title}</Typography>
        {children}
    </>
);

const PrivacyPolicy = () => {
    usePageTitle('Privacy Policy', 'How Regowned collects, uses, and protects your information.');
    return (
    <Container maxWidth="md" sx={{ py: 6 }}>
        <Typography variant="h4" gutterBottom>Privacy Policy</Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>Last updated: August 2026</Typography>
        <Paper variant="outlined" sx={{ p: { xs: 3, sm: 4 } }}>
            <Typography>
                This Privacy Policy explains what information Regowned collects, how we use it, and the choices
                you have. By using Regowned, you agree to the practices described here.
            </Typography>

            <Section title="1. Information We Collect">
                <List dense sx={{ listStyleType: 'disc', pl: 3 }}>
                    <ListItem sx={{ display: 'list-item', px: 0 }}>
                        <ListItemText primary="Account information: your name, email address, phone number, and a securely hashed password." />
                    </ListItem>
                    <ListItem sx={{ display: 'list-item', px: 0 }}>
                        <ListItemText primary="Listing content: photos, descriptions, and other details you submit for gowns or business ads." />
                    </ListItem>
                    <ListItem sx={{ display: 'list-item', px: 0 }}>
                        <ListItemText primary="Payment information: handled entirely by our payment processor, Stripe. Regowned never receives or stores your full card number." />
                    </ListItem>
                    <ListItem sx={{ display: 'list-item', px: 0 }}>
                        <ListItemText primary="Communications: messages you send us, and inquiry activity on listings (for example, when you click 'I'm interested' on a gown)." />
                    </ListItem>
                </List>
            </Section>

            <Section title="2. How We Use Information">
                <List dense sx={{ listStyleType: 'disc', pl: 3 }}>
                    <ListItem sx={{ display: 'list-item', px: 0 }}>
                        <ListItemText primary="To operate the marketplace: creating your account, publishing your listings, and connecting you with interested buyers, renters, or sellers." />
                    </ListItem>
                    <ListItem sx={{ display: 'list-item', px: 0 }}>
                        <ListItemText primary="To process payments and manage subscriptions for listing and ad fees." />
                    </ListItem>
                    <ListItem sx={{ display: 'list-item', px: 0 }}>
                        <ListItemText primary="To send transactional emails — submission confirmations, approval/rejection notices, saved-search alerts, and account-related messages." />
                    </ListItem>
                    <ListItem sx={{ display: 'list-item', px: 0 }}>
                        <ListItemText primary="To review submissions for quality and policy compliance, and to respond to reports or concerns about a listing." />
                    </ListItem>
                </List>
            </Section>

            <Section title="3. What We Share, and With Whom">
                <List dense sx={{ listStyleType: 'disc', pl: 3 }}>
                    <ListItem sx={{ display: 'list-item', px: 0 }}>
                        <ListItemText primary="With other users: your name (only if you choose to display it), and your phone number and email, are shown to someone only after they express interest in your listing — never published openly." />
                    </ListItem>
                    <ListItem sx={{ display: 'list-item', px: 0 }}>
                        <ListItemText primary="With service providers who help us run the Service: Stripe (payments), Microsoft Azure (hosting, file storage, and email delivery). These providers only receive what they need to perform their function and are not permitted to use your data for their own purposes." />
                    </ListItem>
                    <ListItem sx={{ display: 'list-item', px: 0 }}>
                        <ListItemText primary="We do not sell your personal information." />
                    </ListItem>
                </List>
            </Section>

            <Section title="4. Data Retention">
                <Typography>
                    We keep your account and listing information for as long as your account is active, and for
                    a reasonable period afterward for recordkeeping and legal purposes. You can ask us to delete
                    your account and associated personal data at any time, subject to any retention we're legally
                    required to keep (for example, payment records).
                </Typography>
            </Section>

            <Section title="5. Your Choices">
                <List dense sx={{ listStyleType: 'disc', pl: 3 }}>
                    <ListItem sx={{ display: 'list-item', px: 0 }}>
                        <ListItemText primary="You control whether your name is shown publicly on a listing." />
                    </ListItem>
                    <ListItem sx={{ display: 'list-item', px: 0 }}>
                        <ListItemText primary="You can unsubscribe from saved-search email alerts at any time via the link in those emails." />
                    </ListItem>
                    <ListItem sx={{ display: 'list-item', px: 0 }}>
                        <ListItemText primary="You can request a copy of, or the deletion of, your personal data by contacting us." />
                    </ListItem>
                </List>
            </Section>

            <Section title="6. Children's Privacy">
                <Typography>
                    Regowned is not directed at children, and we don't knowingly collect information from anyone
                    under 18.
                </Typography>
            </Section>

            <Section title="7. Changes to This Policy">
                <Typography>
                    We may update this Privacy Policy from time to time. If we make material changes, we'll
                    update the "Last updated" date above.
                </Typography>
            </Section>

            <Section title="8. Contact">
                <Typography>
                    Questions about this Privacy Policy, or a request to access or delete your data? Reach out
                    through the contact options available on the Service.
                </Typography>
            </Section>
        </Paper>
    </Container>
    );
};

export default PrivacyPolicy;

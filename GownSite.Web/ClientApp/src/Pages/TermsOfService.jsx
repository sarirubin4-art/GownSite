import React from 'react';
import { Container, Typography, Paper, List, ListItem, ListItemText } from '@mui/material';

const Section = ({ title, children }) => (
    <>
        <Typography variant="h6" sx={{ mt: 4, mb: 1 }}>{title}</Typography>
        {children}
    </>
);

const TermsOfService = () => (
    <Container maxWidth="md" sx={{ py: 6 }}>
        <Typography variant="h4" gutterBottom>Terms of Service</Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>Last updated: August 2026</Typography>
        <Paper variant="outlined" sx={{ p: { xs: 3, sm: 4 } }}>
            <Typography>
                Welcome to Regowned. These Terms of Service ("Terms") govern your use of the Regowned website and
                services (the "Service"), operated by Regowned. By creating an account or using the Service, you
                agree to these Terms. If you don't agree, please don't use the Service.
            </Typography>

            <Section title="1. What Regowned Is">
                <Typography>
                    Regowned is an online marketplace where people can buy, sell, and rent gowns for simchas —
                    weddings, bar/bat mitzvahs, and other celebrations — and where simcha-related businesses
                    (hair, makeup, alterations, photography, party planning, and similar) can advertise their
                    services. Regowned is a platform that connects buyers, sellers, renters, and service
                    providers — <strong>we are not a party to any transaction, rental agreement, or service
                    arrangement made between users.</strong> We don't inspect, guarantee, insure, or take
                    responsibility for the condition, authenticity, fit, or delivery of any gown, or for the
                    quality of any advertised service.
                </Typography>
            </Section>

            <Section title="2. Accounts">
                <List dense sx={{ listStyleType: 'disc', pl: 3 }}>
                    <ListItem sx={{ display: 'list-item', px: 0 }}>
                        <ListItemText primary="You must provide accurate information when creating an account, and keep your login credentials secure." />
                    </ListItem>
                    <ListItem sx={{ display: 'list-item', px: 0 }}>
                        <ListItemText primary="You're responsible for all activity that happens under your account." />
                    </ListItem>
                    <ListItem sx={{ display: 'list-item', px: 0 }}>
                        <ListItemText primary="You must be at least 18 years old to create an account or make a purchase." />
                    </ListItem>
                </List>
            </Section>

            <Section title="3. Posting Listings and Ads">
                <List dense sx={{ listStyleType: 'disc', pl: 3 }}>
                    <ListItem sx={{ display: 'list-item', px: 0 }}>
                        <ListItemText primary="You must own the gown you're listing, or have the right to sell, rent, or advertise it." />
                    </ListItem>
                    <ListItem sx={{ display: 'list-item', px: 0 }}>
                        <ListItemText primary="Photos and descriptions must accurately represent the item or service — no misleading claims about condition, size, or origin." />
                    </ListItem>
                    <ListItem sx={{ display: 'list-item', px: 0 }}>
                        <ListItemText primary="Every gown listing and business ad is reviewed before it goes live. We may reject a submission or take down an already-live listing at our discretion — for example if it violates these Terms, appears fraudulent, or receives credible complaints — and will let you know why by email." />
                    </ListItem>
                    <ListItem sx={{ display: 'list-item', px: 0 }}>
                        <ListItemText primary="You're solely responsible for arranging payment, delivery, fitting, and any other logistics directly with the other party. Regowned does not process payments between buyers and sellers, hold funds in escrow, or mediate disputes." />
                    </ListItem>
                </List>
            </Section>

            <Section title="4. Fees, Subscriptions & Promo Codes">
                <List dense sx={{ listStyleType: 'disc', pl: 3 }}>
                    <ListItem sx={{ display: 'list-item', px: 0 }}>
                        <ListItemText primary="Listing a gown or placing a business ad requires a recurring monthly fee, charged via our payment processor (Stripe) once your submission is approved. Current pricing is shown before you add a payment method." />
                    </ListItem>
                    <ListItem sx={{ display: 'list-item', px: 0 }}>
                        <ListItemText primary="Adding a card does not charge you immediately — you're only charged once your listing or ad is approved and goes live." />
                    </ListItem>
                    <ListItem sx={{ display: 'list-item', px: 0 }}>
                        <ListItemText primary="You can cancel an active listing or ad at any time from My Listings or My Ads, which stops future billing immediately." />
                    </ListItem>
                    <ListItem sx={{ display: 'list-item', px: 0 }}>
                        <ListItemText primary="Promotional codes, including any discounted or free introductory period, are subject to the specific terms disclosed at the time they're offered and may be changed, limited, or discontinued at any time. Billing automatically reverts to the regular price once a promotional period ends." />
                    </ListItem>
                </List>
            </Section>

            <Section title="5. Prohibited Conduct">
                <Typography sx={{ mb: 1 }}>You agree not to:</Typography>
                <List dense sx={{ listStyleType: 'disc', pl: 3 }}>
                    <ListItem sx={{ display: 'list-item', px: 0 }}>
                        <ListItemText primary="Post counterfeit, stolen, or misrepresented items." />
                    </ListItem>
                    <ListItem sx={{ display: 'list-item', px: 0 }}>
                        <ListItemText primary="Use the Service for any unlawful purpose, or to harass, defraud, or mislead other users." />
                    </ListItem>
                    <ListItem sx={{ display: 'list-item', px: 0 }}>
                        <ListItemText primary="Attempt to circumvent our review process, payment system, or account restrictions." />
                    </ListItem>
                    <ListItem sx={{ display: 'list-item', px: 0 }}>
                        <ListItemText primary="Scrape, copy, or republish content from the Service without permission." />
                    </ListItem>
                </List>
            </Section>

            <Section title="6. Disclaimers & Limitation of Liability">
                <Typography>
                    The Service is provided "as is." Regowned makes no warranties about the accuracy of listings,
                    the conduct of other users, or the availability or uninterrupted operation of the Service.
                    To the fullest extent permitted by law, Regowned is not liable for any indirect, incidental,
                    or consequential damages arising from your use of the Service, or from any transaction,
                    rental, or service arrangement between users.
                </Typography>
            </Section>

            <Section title="7. Termination">
                <Typography>
                    We may suspend or terminate your account at any time for violating these Terms. You may stop
                    using the Service and close your account at any time.
                </Typography>
            </Section>

            <Section title="8. Changes to These Terms">
                <Typography>
                    We may update these Terms from time to time. If we make material changes, we'll update the
                    "Last updated" date above. Continuing to use the Service after changes take effect means you
                    accept the updated Terms.
                </Typography>
            </Section>

            <Section title="9. Contact">
                <Typography>
                    Questions about these Terms? Reach out through the contact options available on the Service.
                </Typography>
            </Section>
        </Paper>
    </Container>
);

export default TermsOfService;

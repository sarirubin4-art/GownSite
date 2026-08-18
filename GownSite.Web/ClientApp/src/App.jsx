import React from 'react';
import { Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import { AuthProvider } from './context/AuthContext';
import Home from './Pages/Home';
import Login from './Pages/Login';
import Signup from './Pages/Signup';
import ForgotPassword from './Pages/ForgotPassword';
import ResetPassword from './Pages/ResetPassword';
import PostGownTerms from './Pages/PostGownTerms';
import GownPostingForm from './Pages/GownPostingForm';
import PaymentPage from './Pages/PaymentPage';
import PaymentSuccess from './Pages/PaymentSuccess';
import PaymentSetupPage from './Pages/PaymentSetupPage';
import PaymentSetupSuccess from './Pages/PaymentSetupSuccess';
import BulkGownPostingForm from './Pages/BulkGownPostingForm';
import BulkPaymentSetupPage from './Pages/BulkPaymentSetupPage';
import BulkPaymentSetupSuccess from './Pages/BulkPaymentSetupSuccess';
import SearchGowns from './Pages/SearchGowns';
import ViewGown from './Pages/ViewGown';
import MyListings from './Pages/MyListings';
import AdDetail from './Pages/AdDetail';
import BrowseAds from './Pages/BrowseAds';
import AdvertiseTerms from './Pages/AdvertiseTerms';
import AdPostingForm from './Pages/AdPostingForm';
import AdPaymentPage from './Pages/AdPaymentPage';
import AdPaymentSuccess from './Pages/AdPaymentSuccess';
import AdPaymentSetupPage from './Pages/AdPaymentSetupPage';
import AdPaymentSetupSuccess from './Pages/AdPaymentSetupSuccess';
import MyAds from './Pages/MyAds';
import AdminDashboard from './Pages/AdminDashboard';
import TermsOfService from './Pages/TermsOfService';
import PrivacyPolicy from './Pages/PrivacyPolicy';
import BusinessBillingSetupPage from './Pages/BusinessBillingSetupPage';
import BusinessBillingSetupSuccess from './Pages/BusinessBillingSetupSuccess';

const App = () => {
    return (
        <AuthProvider>
            <Layout>
                <Routes>
                    <Route path='/' element={<Home />} />
                    <Route path='/login' element={<Login />} />
                    <Route path='/forgot-password' element={<ForgotPassword />} />
                    <Route path='/reset-password' element={<ResetPassword />} />
                    <Route path='/signup' element={<Signup />} />
                    <Route path='/postagown' element={<PostGownTerms />} />
                    <Route path='/postagown/terms' element={<PostGownTerms />} />
                    <Route path='/postagown/form' element={<GownPostingForm />} />
                    <Route path='/postagown/payment/:postingId' element={<PaymentPage />} />
                    <Route path='/paymentsuccess' element={<PaymentSuccess />} />
                    <Route path='/postagown/payment-setup/:postingId' element={<PaymentSetupPage />} />
                    <Route path='/postagown/setup-success' element={<PaymentSetupSuccess />} />
                    <Route path='/postagown/bulk-form' element={<BulkGownPostingForm />} />
                    <Route path='/postagown/bulk-payment-setup' element={<BulkPaymentSetupPage />} />
                    <Route path='/postagown/bulk-setup-success' element={<BulkPaymentSetupSuccess />} />
                    <Route path='/search' element={<SearchGowns />} />
                    <Route path='/gown/:id' element={<ViewGown />} />
                    <Route path='/mylistings' element={<MyListings />} />
                    <Route path='/ad/:id' element={<AdDetail />} />
                    <Route path='/ads' element={<BrowseAds />} />
                    <Route path='/advertise' element={<AdvertiseTerms />} />
                    <Route path='/advertise/terms' element={<AdvertiseTerms />} />
                    <Route path='/advertise/form' element={<AdPostingForm />} />
                    <Route path='/advertise/payment/:adId' element={<AdPaymentPage />} />
                    <Route path='/adpaymentsuccess' element={<AdPaymentSuccess />} />
                    <Route path='/advertise/payment-setup/:adId' element={<AdPaymentSetupPage />} />
                    <Route path='/advertise/setup-success' element={<AdPaymentSetupSuccess />} />
                    <Route path='/myads' element={<MyAds />} />
                    <Route path='/admin' element={<AdminDashboard />} />
                    <Route path='/terms' element={<TermsOfService />} />
                    <Route path='/privacy' element={<PrivacyPolicy />} />
                    <Route path='/business/billing-setup' element={<BusinessBillingSetupPage />} />
                    <Route path='/business/billing-setup-success' element={<BusinessBillingSetupSuccess />} />
                </Routes>
            </Layout>
        </AuthProvider>
    );
}

export default App;

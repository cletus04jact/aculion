import React, { useState, useRef, useEffect } from 'react';
import RoadmapTimeline from './components/RoadmapTimeline';
import LiveDashboard from './components/LiveDashboard';
import PrivacyFirstPreview from './components/PrivacyFirstPreview';
import HeroCityAnalytics from './components/HeroCityAnalytics';
import SmartCityBackground from './components/SmartCityBackground';
import BrandPortal from './components/BrandPortal';
import MediaOwnerPage from './components/MediaOwnerPage';
import DemoDashboardPage from './components/DemoDashboardPage';
import LocationIntelligence from './pages/LocationIntelligence';
import ContactSection from './components/ContactSection';
import newLogo from './assets/aculion_logo_transparent.png';
import { supabase, resolveUserRoleFromSupabase } from './services/supabase';
import SignInPage from './pages/SignInPage';
import MediaProfilePage from './pages/MediaProfilePage';
import BookDemoModal from './components/BookDemoModal';
import { billboardService } from './services/billboard.service';

const INITIAL_BILLBOARDS = [
  {
    id: 'ACU-AN-001',
    name: 'Anna Nagar – Shanthi Colony Junction',
    location: 'Shanthi Colony Junction, Anna Nagar',
    address: 'Shanthi Colony Junction, Anna Nagar',
    city: 'Chennai',
    state: 'Tamil Nadu',
    country: 'India',
    width: '40 ft',
    height: '20 ft',
    size: '40 ft × 20 ft',
    type: 'Static Billboard',
    screenType: 'High-Brightness Outdoor LED',
    status: 'Active',
    latitude: 13.0827,
    longitude: 80.2707,
    image: '/anna_nagar_location.png',
    feedImage: '/anna_nagar_feed.png'
  },
  {
    id: 'ACU-TN-002',
    name: 'T Nagar – Pondy Bazaar Commercial Hub',
    location: 'Pondy Bazaar Main Road, T. Nagar',
    address: 'Pondy Bazaar Main Road, T. Nagar',
    city: 'Chennai',
    state: 'Tamil Nadu',
    country: 'India',
    width: '50 ft',
    height: '25 ft',
    size: '50 ft × 25 ft',
    type: 'Static Billboard',
    screenType: 'High-Brightness Outdoor LED',
    status: 'Active',
    latitude: 13.0418,
    longitude: 80.2341,
    image: '/blog_attention_metrics.png',
    feedImage: '/anna_nagar_feed.png'
  },
  {
    id: 'ACU-VL-003',
    name: 'Velachery Main Road – Vijaya Nagar',
    location: 'Vijaya Nagar Bus Stand, Velachery',
    address: 'Vijaya Nagar Bus Stand, Velachery',
    city: 'Chennai',
    state: 'Tamil Nadu',
    country: 'India',
    width: '30 ft',
    height: '15 ft',
    size: '30 ft × 15 ft',
    type: 'Static Billboard',
    screenType: 'LED Outdoor Display',
    status: 'Active',
    latitude: 12.9780,
    longitude: 80.2210,
    image: '/blog_billboard_roi.png',
    feedImage: '/anna_nagar_feed.png'
  },
  {
    id: 'ACU-OMR-004',
    name: 'OMR Expressway – Tidel Park Flyover',
    location: 'Tidel Park Junction, OMR',
    address: 'Tidel Park Junction, OMR',
    city: 'Chennai',
    state: 'Tamil Nadu',
    country: 'India',
    width: '60 ft',
    height: '30 ft',
    size: '60 ft × 30 ft',
    type: 'Static Billboard',
    screenType: 'P4 Outdoor LED',
    status: 'Active',
    latitude: 12.9892,
    longitude: 80.2483,
    image: '/blog_smart_city.png',
    feedImage: '/anna_nagar_feed.png'
  }
];

const hashPassword = async (password) => {
  const msgBuffer = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
};

const generateNextRegNumber = () => {
  const users = JSON.parse(localStorage.getItem('aculion_users') || '[]');
  let maxNum = 1233;
  users.forEach(u => {
    if (u.regNumber && u.regNumber.startsWith('ACU-')) {
      const numPart = parseInt(u.regNumber.replace('ACU-', ''), 10);
      if (!isNaN(numPart) && numPart > maxNum) {
        maxNum = numPart;
      }
    }
  });
  return `ACU-${maxNum + 1}`;
};

export default function App() {
  const [route, setRoute] = useState(window.location.pathname);

  useEffect(() => {
    const handleLocationChange = () => {
      setRoute(window.location.pathname);
    };
    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

  const navigateTo = (e, path) => {
    if (e) e.preventDefault();
    window.history.pushState(null, '', path);
    setRoute(path);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  // ── Offset-aware smooth scroll (accounts for fixed header) ──
  const scrollToSection = (sectionId) => {
    const el = document.getElementById(sectionId);
    if (!el) return;
    const headerHeight = document.querySelector('.main-header')?.offsetHeight || 72;
    const top = el.getBoundingClientRect().top + window.scrollY - headerHeight - 16;
    window.scrollTo({ top, behavior: 'smooth' });
  };

  const handleNavLinkClick = (e, path, sectionId) => {
    if (e) e.preventDefault();
    if (sectionId) {
      const el = document.getElementById(sectionId);
      if (el) {
        scrollToSection(sectionId);
        return;
      }
    }
    if (route !== path) {
      window.history.pushState(null, '', path);
      setRoute(path);
      window.scrollTo({ top: 0, behavior: 'instant' });
      if (sectionId) setTimeout(() => scrollToSection(sectionId), 120);
    } else if (sectionId) {
      scrollToSection(sectionId);
    }
  };

  // ── Active nav section tracker (IntersectionObserver) ─────
  const [activeSection, setActiveSection] = useState('');
  const [contactInquiryType, setContactInquiryType] = useState('Contact Sales');
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);

  const handleContactNavigation = (inquiryType = 'Contact Sales') => {
    setContactInquiryType(inquiryType);
    scrollToSection('contact-section');
  };

  const handleDemoNavigation = (e) => {
    if (e) e.preventDefault();
    setIsDemoModalOpen(true);
  };

  useEffect(() => {
    if (route === '/book-demo') {
      setIsDemoModalOpen(true);
    }
  }, [route]);

  useEffect(() => {
    const sectionIds = ['hero', 'features', 'solutions', 'services', 'about', 'contact-section', 'footer'];
    const observers = [];
    const visibleMap = {};

    const pick = () => {
      // Choose the section with the smallest positive top offset (highest on screen)
      let best = '';
      let bestTop = Infinity;
      for (const id of sectionIds) {
        if (visibleMap[id]) {
          const el = document.getElementById(id);
          if (el) {
            const top = Math.abs(el.getBoundingClientRect().top);
            if (top < bestTop) { bestTop = top; best = id; }
          }
        }
      }
      setActiveSection(best);
    };

    sectionIds.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      const obs = new IntersectionObserver(
        ([entry]) => {
          visibleMap[id] = entry.isIntersecting;
          pick();
        },
        { threshold: 0.15 }
      );
      obs.observe(el);
      observers.push(obs);
    });

    return () => observers.forEach(o => o.disconnect());
  }, [route]);

  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    return localStorage.getItem('aculion_current_user') !== null;
  });
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('aculion_current_user');
    return stored ? JSON.parse(stored) : null;
  });

  const [authErrorMessage, setAuthErrorMessage] = useState('');

  // Supabase Auth listener with 3-table master role mapping
  useEffect(() => {
    // Derive user profile info from Supabase auth metadata only
    // (user_profile_master table has been dropped)
    const getUserProfileFromMetadata = (email, metadata) => ({
      name: metadata?.fullName || metadata?.name || email.split('@')[0],
      company: metadata?.company || 'Aculion Partner'
    });

    const handleSessionChange = async (session) => {
      if (!session) {
        setIsLoggedIn(false);
        setUser(null);
        localStorage.removeItem('aculion_current_user');
        return;
      }

      // Check 3 master tables: admin_master -> billboard_owner_master -> brand_owner_master
      const roleResult = await resolveUserRoleFromSupabase(session.user);

      if (roleResult.accessDenied) {
        console.warn('[Auth] Access denied:', roleResult.error);
        setAuthErrorMessage(roleResult.error || 'Access Denied: Account not registered in master role tables.');
        await supabase.auth.signOut();
        setIsLoggedIn(false);
        setUser(null);
        localStorage.removeItem('aculion_current_user');
        if (window.location.pathname !== '/sign-in') {
          window.history.pushState(null, '', '/sign-in');
          setRoute('/sign-in');
        }
        return;
      }

      setAuthErrorMessage('');
      setIsLoggedIn(true);
      const metadata = session.user.user_metadata || {};
      const profileInfo = getUserProfileFromMetadata(session.user.email, metadata);
      const u = {
        email: session.user.email,
        name: roleResult.username || profileInfo.name || metadata.fullName || metadata.name || session.user.email.split('@')[0],
        company: profileInfo.company || metadata.company || 'Aculion Partner',
        role: roleResult.role,
      };
      setUser(u);
      localStorage.setItem('aculion_current_user', JSON.stringify(u));

      // Redirect based on role after sign-in
      if (window.location.pathname === '/sign-in') {
        const targetPath = roleResult.targetPath || '/media-profile';
        window.history.pushState(null, '', targetPath);
        setRoute(targetPath);
      }
    };

    // 1. Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      handleSessionChange(session);
    });

    // 2. Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      handleSessionChange(session);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // ── Billboards & Asset Management State ──
  const [billboards, setBillboards] = useState([]);
  const [selectedBillboard, setSelectedBillboard] = useState(null);

  // Fetch billboards via billboard service on mount and when user session changes
  useEffect(() => {
    billboardService.getBillboards().then((rows) => {
      if (rows && rows.length > 0) {
        setBillboards(rows);
        // Find if there is a billboard code in the current URL path
        const dashMatch = window.location.pathname.match(/^\/([^/]+)\/([^/]+)\/dashboard(?:\/[^/]*)?$/);
        const urlBbCode = dashMatch ? dashMatch[2] : null;
        const urlBillboard = urlBbCode ? rows.find(b => (b.billboard_code === urlBbCode || b.id === urlBbCode)) : null;

        setSelectedBillboard((prev) => {
          if (urlBillboard) return urlBillboard;
          const stillExists = prev && rows.find(b => (b.billboard_code || b.id) === (prev.billboard_code || prev.id));
          return stillExists ? prev : rows[0];
        });
      }
    }).catch((err) => {
      console.error('[App] Billboard fetch error:', err);
    });
  }, [isLoggedIn, user?.email]);

  // ── URL helpers ──────────────────────────────────────────
  // Converts a display name to a URL-safe slug (e.g. "Aculion Dev Admin" → "aculion-dev-admin")
  const slugify = (str) =>
    (str || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  // Derive a stable URL slug from the logged-in user (prefers name, falls back to email prefix)
  const getUserSlug = (u) =>
    slugify(u?.name || u?.email?.split('@')[0] || 'user');

  // Route pattern matchers
  const MEDIA_PROFILE_RE = /^\/([^/]+)\/media-profile\/?$/;
  const DASHBOARD_RE     = /^\/([^/]+)\/([^/]+)\/dashboard(?:\/[^/]*)?$/;

  const handleSelectBillboard = (billboard) => {
    setSelectedBillboard(billboard);
    localStorage.setItem('aculion_selected_billboard', JSON.stringify(billboard));
    const slug   = getUserSlug(user);
    const bbCode = billboard.billboard_code || billboard.id || 'bb';
    const path   = `/${slug}/${bbCode}/dashboard/audience-intelligence`;
    window.history.pushState(null, '', path);
    setRoute(path);
  };

  const handleAddBillboard = (newAsset) => {
    setBillboards(prev => [...prev, newAsset]);
  };

  // Auth protection and route redirection effect
  useEffect(() => {
    const mpMatch   = MEDIA_PROFILE_RE.test(route);
    const dashMatch = DASHBOARD_RE.test(route);

    if (!isLoggedIn) {
      // Redirect unauthenticated users away from protected routes
      if (mpMatch || dashMatch || route === '/demo-dashboard' || route === '/location-intelligence') {
        window.history.pushState(null, '', '/sign-in');
        setRoute('/sign-in');
      }
    } else {
      const mySlug = getUserSlug(user);

      if (route === '/sign-in' || route === '/media-profile') {
        // After sign-in, go to the user-scoped media-profile
        if (user?.role === 'Brand Advertiser') {
          navigateTo(null, '/demo-dashboard');
        } else {
          navigateTo(null, `/${mySlug}/media-profile/`);
        }
      } else if (mpMatch) {
        // Ownership check: wrong user in URL → redirect to correct URL
        const urlSlug = route.split('/')[1];
        if (urlSlug !== mySlug) {
          navigateTo(null, `/${mySlug}/media-profile/`);
        }
      } else if (dashMatch) {
        // Ownership check for dashboard routes
        const urlSlug = route.split('/')[1];
        if (urlSlug !== mySlug) {
          navigateTo(null, `/${mySlug}/media-profile/`);
        }
        // Ensure a billboard is selected
        if (!selectedBillboard) {
          setSelectedBillboard(billboards[0] || INITIAL_BILLBOARDS[0]);
        }
      } else if (route === '/location-intelligence') {
        if (!selectedBillboard) {
          setSelectedBillboard(billboards[0] || INITIAL_BILLBOARDS[0]);
        }
      }
    }
  }, [isLoggedIn, route, user?.role, selectedBillboard, billboards]);

  // Modals state
  const [showRegister, setShowRegister] = useState(false);
  const [showSignin, setShowSignin] = useState(false);
  const [solutionTab, setSolutionTab] = useState('brands');
  const [servicesTabIdx, setServicesTabIdx] = useState(0);

  // Profile dropdown state
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const closeTimerRef = useRef(null);
  const openTimerRef = useRef(null);

  // Register step timeline
  const [regStep, setRegStep] = useState(1);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [company, setCompany] = useState('');
  const [regNumber, setRegNumber] = useState('');
  const [regNumberError, setRegNumberError] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegConfirmPassword, setShowRegConfirmPassword] = useState(false);
  const [role, setRole] = useState('Media Owner (Billboard Operator)');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [otpError, setOtpError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passError, setPassError] = useState('');
  const [confirmError, setConfirmError] = useState('');
  const [successProgress, setSuccessProgress] = useState(0);

  // Searchable countries list for Phone Number input selector
  const countries = [
    { name: 'India', code: '+91', flag: '🇮🇳', minLen: 10, maxLen: 10, placeholder: '98765 43210' },
    { name: 'United States', code: '+1', flag: '🇺🇸', minLen: 10, maxLen: 10, placeholder: '(201) 555-0123' },
    { name: 'United Kingdom', code: '+44', flag: '🇬🇧', minLen: 10, maxLen: 10, placeholder: '7911 123456' },
    { name: 'Australia', code: '+61', flag: '🇦🇺', minLen: 9, maxLen: 9, placeholder: '412 345 678' },
    { name: 'Singapore', code: '+65', flag: '🇸🇬', minLen: 8, maxLen: 8, placeholder: '8123 4567' },
    { name: 'Germany', code: '+49', flag: '🇩🇪', minLen: 10, maxLen: 11, placeholder: '151 23456789' },
    { name: 'Canada', code: '+1', flag: '🇨🇦', minLen: 10, maxLen: 10, placeholder: '(204) 555-0123' },
    { name: 'United Arab Emirates', code: '+971', flag: '🇦🇪', minLen: 9, maxLen: 9, placeholder: '50 123 4567' }
  ];

  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [phoneIsValid, setPhoneIsValid] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState(countries[0]);
  const [countrySearch, setCountrySearch] = useState('');
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const countryDropdownRef = useRef(null);
  const countrySearchRef = useRef(null);

  // Mobile menu toggle
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);



  // Form Validation & Sign In states
  const [signinRegNumber, setSigninRegNumber] = useState('');
  const [signinPassword, setSigninPassword] = useState('');
  const [signinRole, setSigninRole] = useState('');
  const [signinRegNumberError, setSigninRegNumberError] = useState('');
  const [signinPassError, setSigninPassError] = useState('');
  const [signinRoleError, setSigninRoleError] = useState('');
  const [signinSuccessMessage, setSigninSuccessMessage] = useState('');
  const [fullNameError, setFullNameError] = useState('');
  const [companyError, setCompanyError] = useState('');
  const [generatedOtp, setGeneratedOtp] = useState('');

  // Sign In Redesign states
  const [signinUsername, setSigninUsername] = useState('');
  const [signinEmail, setSigninEmail] = useState('');
  const [signinCompany, setSigninCompany] = useState('');
  const [signinUsernameError, setSigninUsernameError] = useState('');
  const [signinEmailError, setSigninEmailError] = useState('');
  const [signinCompanyError, setSigninCompanyError] = useState('');
  const [signinGeneralError, setSigninGeneralError] = useState('');

  // Forgot Password flow states
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotStep, setForgotStep] = useState(1);
  const [forgotEmailOrRegNumber, setForgotEmailOrRegNumber] = useState('');
  const [forgotEmailOrRegNumberError, setForgotEmailOrRegNumberError] = useState('');
  const [forgotOtp, setForgotOtp] = useState('');
  const [forgotOtpError, setForgotOtpError] = useState('');
  const [forgotGeneratedOtp, setForgotGeneratedOtp] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotNewPasswordError, setForgotNewPasswordError] = useState('');
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState('');
  const [forgotConfirmPasswordError, setForgotConfirmPasswordError] = useState('');
  const [forgotSuccessMessage, setForgotSuccessMessage] = useState('');
  const [forgotTargetEmail, setForgotTargetEmail] = useState('');

  React.useEffect(() => {
    const testUser = {
      email: 'connect@aculion.com',
      password: '92c3bb3b439c7907d48ade01205c6bcf46b56df92c8f12f79194cf7011542d67', // SHA-256 of Divyadivya09
      company: 'Aculion Intelligence Corp',
      fullName: 'Aculion',
      role: 'Media Owner (Billboard Operator)',
      regNumber: 'ACU-1234'
    };

    const usersStr = localStorage.getItem('aculion_users');
    if (!usersStr) {
      localStorage.setItem('aculion_users', JSON.stringify([
        testUser,
        {
          email: 'demo@aculion.com',
          password: 'ef92b778bafe4de167db03d65685767312e23b8e7cbf3e5dfd9b3fa47d227c3f', // SHA-256 of password123
          company: 'Demo Corporation',
          fullName: 'Demo User',
          role: 'Media Owner (Billboard Operator)',
          regNumber: 'ACU-1234'
        },
        {
          email: 'brand@aculion.com',
          password: 'ef92b778bafe4de167db03d65685767312e23b8e7cbf3e5dfd9b3fa47d227c3f', // SHA-256 of password123
          company: 'Aculion Brand Partner',
          fullName: 'Brand Advertiser User',
          role: 'Brand Advertiser',
          regNumber: 'ACU-5678'
        },
        {
          email: 'admin@aculion.com',
          password: 'ef92b778bafe4de167db03d65685767312e23b8e7cbf3e5dfd9b3fa47d227c3f', // SHA-256 of password123
          company: 'Aculion HQ',
          fullName: 'Administrator User',
          role: 'Administrator',
          regNumber: 'ACU-9012'
        }
      ]));
    } else {
      try {
        const parsed = JSON.parse(usersStr);
        let updated = false;

        const testUserIdx = parsed.findIndex(u => u.email && u.email.trim().toLowerCase() === 'connect@aculion.com');
        if (testUserIdx === -1) {
          parsed.push(testUser);
          updated = true;
        } else {
          const u = parsed[testUserIdx];
          if (u.regNumber !== 'ACU-1234' || u.password !== testUser.password) {
            parsed[testUserIdx] = { ...u, regNumber: 'ACU-1234', password: testUser.password };
            updated = true;
          }
        }

        parsed.forEach(u => {
          if (u.role === 'owner') { u.role = 'Media Owner (Billboard Operator)'; updated = true; }
          if (u.role === 'brand') { u.role = 'Brand Advertiser'; updated = true; }
          if (u.role === 'admin') { u.role = 'Administrator'; updated = true; }

          if (u.email === 'demo@aculion.com' && !u.regNumber) { u.regNumber = 'ACU-1234'; updated = true; }
          if (u.email === 'brand@aculion.com' && !u.regNumber) { u.regNumber = 'ACU-5678'; updated = true; }
          if (u.email === 'admin@aculion.com' && !u.regNumber) { u.regNumber = 'ACU-9012'; updated = true; }

          if (u.password && u.password.length !== 64) {
            if (u.password === 'password123') {
              u.password = 'ef92b778bafe4de167db03d65685767312e23b8e7cbf3e5dfd9b3fa47d227c3f';
              updated = true;
            }
          }
        });
        if (updated) {
          localStorage.setItem('aculion_users', JSON.stringify(parsed));
        }
      } catch (e) {
        // ignore
      }
    }
  }, []);

  // Close country dropdown on click outside
  React.useEffect(() => {
    const handleClickOutside = (event) => {
      if (countryDropdownRef.current && !countryDropdownRef.current.contains(event.target)) {
        setShowCountryDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Format phone number dynamically based on selected country rules
  const formatPhoneNumber = (value, country) => {
    const clean = value.replace(/\D/g, '');
    if (country.name === 'India') {
      if (clean.length > 5) {
        return `${clean.slice(0, 5)} ${clean.slice(5, 10)}`;
      }
      return clean;
    }
    if (country.name === 'United States' || country.name === 'Canada') {
      if (clean.length > 6) {
        return `${clean.slice(0, 3)} ${clean.slice(3, 6)} ${clean.slice(6, 10)}`;
      }
      if (clean.length > 3) {
        return `${clean.slice(0, 3)} ${clean.slice(3, 6)}`;
      }
      return clean;
    }
    if (clean.length > 7) {
      return `${clean.slice(0, 4)} ${clean.slice(4, 7)} ${clean.slice(7, 11)}`;
    }
    if (clean.length > 4) {
      return `${clean.slice(0, 4)} ${clean.slice(4, 8)}`;
    }
    return clean;
  };

  const validatePhone = (value, country) => {
    const clean = value.replace(/\D/g, '');
    const isValid = clean.length >= country.minLen && clean.length <= country.maxLen;
    setPhoneIsValid(isValid);
    if (clean.length > 0 && !isValid) {
      setPhoneError('Please enter a valid mobile number.');
    } else {
      setPhoneError('');
    }
    return isValid;
  };

  const handlePhoneChange = (e) => {
    const input = e.target.value;
    const clean = input.replace(/\D/g, '');
    const formatted = formatPhoneNumber(clean, selectedCountry);
    setPhone(formatted);
    validatePhone(clean, selectedCountry);
  };

  const sendOtpEmail = (emailAddress, otpCode) => {
    console.log(`[ACULION DEBUG] Sent OTP to ${emailAddress}: ${otpCode}`);

    fetch(`https://formsubmit.co/ajax/${emailAddress}`, {
      method: "POST",
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        _subject: "Aculion Console Verification Code",
        message: `Your Aculion Cloud Console verification code is: ${otpCode}. Please enter this code in the registration wizard to complete setup.`
      })
    })
      .then(response => response.json())
      .then(data => {
        console.log("[ACULION DEBUG] FormSubmit Response:", data);
      })
      .catch(err => {
        console.error("[ACULION DEBUG] FormSubmit Error:", err);
      });
  };

  // Simulated validation & step progression
  const handleRegNext = (currentStep) => {
    if (currentStep === 1) {
      let valid = true;

      if (!fullName || fullName.trim().length < 2) {
        setFullNameError('Full name is required (minimum 2 characters).');
        valid = false;
      } else {
        setFullNameError('');
      }

      if (!company || company.trim().length < 2) {
        setCompanyError('Company name is required (minimum 2 characters).');
        valid = false;
      } else {
        setCompanyError('');
      }

      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!email || !emailPattern.test(email)) {
        setEmailError('Please enter a valid business email.');
        valid = false;
      } else {
        const users = JSON.parse(localStorage.getItem('aculion_users') || '[]');
        const cleanEmail = email.trim().toLowerCase();
        const isDuplicate = users.some(u => u.email && u.email.trim().toLowerCase() === cleanEmail);
        if (isDuplicate) {
          setEmailError('This business email is already registered.');
          valid = false;
        } else {
          setEmailError('');
        }
      }

      if (!phone || !phoneIsValid) {
        setPhoneError('Please enter a valid mobile number.');
        valid = false;
      } else {
        setPhoneError('');
      }

      if (!valid) return;

      if (!regNumber) {
        const nextRegNum = generateNextRegNumber();
        setRegNumber(nextRegNum);
      }
    }
    if (currentStep === 2) {
      let valid = true;
      if (!regNumber || !regNumber.startsWith('ACU-')) {
        setRegNumberError('Register Number is missing.');
        valid = false;
      } else {
        setRegNumberError('');
      }

      if (!validatePasswordStrength(password)) {
        setPassError('Password does not meet strength requirements.');
        valid = false;
      } else {
        setPassError('');
      }

      if (password !== confirmPassword) {
        setConfirmError('Passwords do not match.');
        valid = false;
      } else {
        setConfirmError('');
      }

      if (!agreeTerms) {
        valid = false;
      }

      if (!valid) return;

      handleRegisterSubmit();
      return;
    }
    setRegStep(currentStep + 1);
  };

  const handleRegBack = (currentStep) => {
    setRegStep(currentStep - 1);
  };

  const handleOtpChange = (val, idx) => {
    setOtpError('');
    const newOtp = [...otp];
    newOtp[idx] = val.slice(-1);
    setOtp(newOtp);

    // Auto-focus next field
    if (val && idx < 5) {
      const nextInput = document.getElementById(`otp-input-${idx + 1}`);
      if (nextInput) nextInput.focus();
    }
  };

  const handleOtpKeyDown = (e, idx) => {
    if (e.key === 'Backspace' && !otp[idx] && idx > 0) {
      const prevInput = document.getElementById(`otp-input-${idx - 1}`);
      if (prevInput) prevInput.focus();
    }
  };

  const handleRegisterSubmit = async (e) => {
    if (e) e.preventDefault();

    // Switch to step 3 loader
    setRegStep(3);
    setSuccessProgress(20);

    try {
      const cleanEmail = email.trim().toLowerCase();
      
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: cleanEmail,
        password: password,
        options: {
          data: {
            owner_name: fullName,
            company_name: company
          }
        }
      });

      if (signUpError) {
        setRegStep(2);
        setPassError(signUpError.message || 'Registration failed.');
        setSuccessProgress(0);
        return;
      }

      setSuccessProgress(50);

      // Verify that the trigger created the corresponding billboard_owners record
      let verified = false;
      if (signUpData?.user) {
        for (let i = 0; i < 20; i++) {
          const { data: ownerRecord, error: ownerError } = await supabase
            .from('billboard_owners')
            .select('id')
            .eq('id', signUpData.user.id)
            .maybeSingle();

          if (ownerRecord && ownerRecord.id) {
            verified = true;
            break;
          }
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      if (!verified) {
        setRegStep(2);
        setPassError('Registration succeeded, but billboard owner profile verification timed out. Please try signing in.');
        setSuccessProgress(0);
        return;
      }

      setSuccessProgress(100);

      setTimeout(() => {
        // Clear registration wizard fields
        setRegStep(1);
        setEmail('');
        setPassword('');
        setConfirmPassword('');
        setFullName('');
        setCompany('');
        setRegNumber('');
        setRegNumberError('');
        setAgreeTerms(false);
        setShowRegPassword(false);
        setShowRegConfirmPassword(false);
        setRole('Media Owner (Billboard Operator)');
        setOtp(['', '', '', '', '', '']);
        setOtpError('');
        setEmailError('');
        setPassError('');
        setConfirmError('');
        setPhone('');
        setPhoneError('');
        setPhoneIsValid(false);
        setSuccessProgress(0);

        // Close register modal, open signin modal, pre-populate email, show success message
        setShowRegister(false);
        setShowSignin(true);
        setSigninEmail(cleanEmail);
        setSigninSuccessMessage(`Registration Successful! Please use your email and password to sign in.`);
      }, 500);

    } catch (err) {
      console.error('Registration submit error:', err);
      setRegStep(2);
      setPassError('An unexpected error occurred during registration.');
      setSuccessProgress(0);
    }
  };

  const handleSigninSubmit = async (e) => {
    e.preventDefault();
    setSigninGeneralError('');
    setSigninSuccessMessage('');

    // If using custom sign-in form on landing page, support email & password
    const uEmail = (signinEmail || '').trim().toLowerCase();
    const uPass = (signinPassword || '').trim();

    if (!uEmail || !uPass) {
      setSigninGeneralError('Please enter both email and password.');
      return;
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: uEmail,
        password: uPass,
      });

      if (error) {
        setSigninGeneralError(error.message || 'Invalid email or password.');
        return;
      }

      setSigninSuccessMessage('Login successful. Welcome to Aculion Intelligence Console.');

      setTimeout(() => {
        closeAllModals();
      }, 1500);
    } catch (err) {
      console.error('Signin submit error:', err);
      setSigninGeneralError('Invalid email or password.');
    }
  };

  const handleForgotPasswordSubmit = async (e) => {
    e.preventDefault();

    if (forgotStep === 1) {
      const input = forgotEmailOrRegNumber.trim();
      if (!input) {
        setForgotEmailOrRegNumberError('Please enter your business email or register number.');
        return;
      }

      const users = JSON.parse(localStorage.getItem('aculion_users') || '[]');
      const matchedUser = users.find(u =>
        (u.email && u.email.trim().toLowerCase() === input.toLowerCase()) ||
        (u.regNumber && u.regNumber.trim().toUpperCase() === input.toUpperCase())
      );

      if (!matchedUser) {
        setForgotEmailOrRegNumberError('No account found with this email or register number.');
        return;
      }

      const userEmail = matchedUser.email;
      const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
      setForgotGeneratedOtp(otpCode);
      setForgotTargetEmail(userEmail);

      // Simulate sending OTP/reset link
      sendOtpEmail(userEmail, otpCode);

      setForgotSuccessMessage(`Verification code sent to your registered email: ${userEmail}`);
      setForgotStep(2);
      return;
    }

    if (forgotStep === 2) {
      const code = forgotOtp.trim();
      if (code !== forgotGeneratedOtp) {
        setForgotOtpError('Invalid OTP code. Please check your email and try again.');
        return;
      }

      setForgotOtpError('');
      setForgotSuccessMessage('Security code verified. Please enter your new password.');
      setForgotStep(3);
      return;
    }

    if (forgotStep === 3) {
      let valid = true;
      if (!validatePasswordStrength(forgotNewPassword)) {
        setForgotNewPasswordError('Password does not meet strength requirements (min 8 chars, 1 uppercase, 1 lowercase, 1 number).');
        valid = false;
      } else {
        setForgotNewPasswordError('');
      }

      if (forgotNewPassword !== forgotConfirmPassword) {
        setForgotConfirmPasswordError('Passwords do not match.');
        valid = false;
      } else {
        setForgotConfirmPasswordError('');
      }

      if (!valid) return;

      const hashed = await hashPassword(forgotNewPassword);
      const users = JSON.parse(localStorage.getItem('aculion_users') || '[]');
      const updatedUsers = users.map(u => {
        if (u.email && u.email.trim().toLowerCase() === forgotTargetEmail.toLowerCase()) {
          return { ...u, password: hashed };
        }
        return u;
      });

      localStorage.setItem('aculion_users', JSON.stringify(updatedUsers));

      closeAllModals();
      setShowSignin(true);
      setSigninSuccessMessage('Password updated successfully. Please sign in with your registered details.');
    }
  };

  const resendForgotOtp = () => {
    if (!forgotTargetEmail) return;
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    setForgotGeneratedOtp(otpCode);
    sendOtpEmail(forgotTargetEmail, otpCode);
    setForgotOtpError('A new security code has been sent.');
  };

  const loginAction = (userEmail, userCompany, userRole = 'Media Owner (Billboard Operator)', userName = '') => {
    const userData = {
      email: userEmail,
      name: userName || userEmail.split('@')[0],
      company: userCompany,
      role: userRole
    };
    setUser(userData);
    setIsLoggedIn(true);
    localStorage.setItem('aculion_current_user', JSON.stringify(userData));
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setIsLoggedIn(false);
    setDropdownOpen(false);
    localStorage.removeItem('aculion_current_user');
    navigateTo(null, '/');
  };


  // ── Profile Dropdown Logic ──
  const scheduleOpen = () => {
    clearTimeout(closeTimerRef.current);
    openTimerRef.current = setTimeout(() => setDropdownOpen(true), 100);
  };

  const scheduleClose = () => {
    clearTimeout(openTimerRef.current);
    closeTimerRef.current = setTimeout(() => setDropdownOpen(false), 350);
  };

  const cancelClose = () => {
    clearTimeout(closeTimerRef.current);
  };

  const toggleDropdown = () => {
    clearTimeout(openTimerRef.current);
    clearTimeout(closeTimerRef.current);
    setDropdownOpen(prev => !prev);
  };

  // Close on click outside
  React.useEffect(() => {
    if (!dropdownOpen) return;
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    const handleEsc = (e) => {
      if (e.key === 'Escape') setDropdownOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [dropdownOpen]);



  // Keyboard navigation inside dropdown
  const handleDropdownKeyDown = (e) => {
    if (!dropdownOpen) return;
    const items = dropdownRef.current?.querySelectorAll('.dropdown-item');
    if (!items) return;
    const arr = Array.from(items);
    const focused = document.activeElement;
    const idx = arr.indexOf(focused);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      arr[(idx + 1) % arr.length]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      arr[(idx - 1 + arr.length) % arr.length]?.focus();
    }
  };
  // ── /Profile Dropdown Logic ──

  const closeAllModals = () => {
    setShowRegister(false);
    setShowSignin(false);
    setShowForgotPassword(false);
    // Reset wizard fields
    setRegStep(1);
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setFullName('');
    setCompany('');
    setRegNumber('');
    setRegNumberError('');
    setAgreeTerms(false);
    setShowRegPassword(false);
    setShowRegConfirmPassword(false);
    setRole('Media Owner (Billboard Operator)');
    setOtp(['', '', '', '', '', '']);
    setOtpError('');
    setEmailError('');
    setPassError('');
    setConfirmError('');
    setSigninRegNumber('');
    setSigninPassword('');
    setSigninRole('');
    setSigninRegNumberError('');
    setSigninPassError('');
    setSigninRoleError('');
    setSigninSuccessMessage('');
    setFullNameError('');
    setCompanyError('');
    setPhone('');
    setPhoneError('');
    setPhoneIsValid(false);
    setSuccessProgress(0);

    // Reset Sign In Redesign states
    setSigninUsername('');
    setSigninEmail('');
    setSigninCompany('');
    setSigninUsernameError('');
    setSigninEmailError('');
    setSigninCompanyError('');
    setSigninGeneralError('');

    // Reset Forgot Password states
    setForgotStep(1);
    setForgotEmailOrRegNumber('');
    setForgotEmailOrRegNumberError('');
    setForgotOtp('');
    setForgotOtpError('');
    setForgotGeneratedOtp('');
    setForgotNewPassword('');
    setForgotNewPasswordError('');
    setForgotConfirmPassword('');
    setForgotConfirmPasswordError('');
    setForgotSuccessMessage('');
    setForgotTargetEmail('');
  };

  const triggerResendOtp = () => {
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedOtp(otpCode);
    sendOtpEmail(email, otpCode);
    setOtpError('A new security code has been resent to your email.');
  };

  const isSlide1Valid =
    fullName && fullName.trim().length >= 2 &&
    company && company.trim().length >= 2 &&
    email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) &&
    phone && phoneIsValid;

  const validatePasswordStrength = (pass) => {
    if (!pass) return false;
    const hasUpper = /[A-Z]/.test(pass);
    const hasLower = /[a-z]/.test(pass);
    const hasDigit = /[0-9]/.test(pass);
    return pass.length >= 8 && hasUpper && hasLower && hasDigit;
  };

  const isSlide2Valid =
    regNumber && regNumber.startsWith('ACU-') &&
    validatePasswordStrength(password) &&
    password === confirmPassword &&
    agreeTerms;

  if (MEDIA_PROFILE_RE.test(route) || route === '/media-profile') {
    return (
      <MediaProfilePage
        user={user}
        billboards={billboards}
        onSelectBillboard={handleSelectBillboard}
        onAddBillboard={handleAddBillboard}
        onLogout={handleLogout}
        navigateTo={navigateTo}
      />
    );
  }

  if (DASHBOARD_RE.test(route) || route === '/location-intelligence' || route === '/dashboard' || route.startsWith('/dashboard/')) {
    // Build baseDashboardPath from the new scoped URL, e.g. /developer/ACU-BB-1645/dashboard
    const dashParts = route.split('/');
    const dashIdx   = dashParts.indexOf('dashboard');
    const baseDashboardPath = dashIdx > 0
      ? dashParts.slice(0, dashIdx + 1).join('/')
      : `/dashboard`;
    return (
      <LiveDashboard
        navigateTo={navigateTo}
        selectedBillboard={selectedBillboard}
        billboards={billboards}
        user={user}
        onSelectBillboard={handleSelectBillboard}
        onAddNewMedia={handleAddBillboard}
        baseDashboardPath={baseDashboardPath}
        onBackToProfile={() => navigateTo(null, `/${getUserSlug(user)}/media-profile/`)}
      />
    );
  }


  if (route === '/demo-dashboard') {
    return <DemoDashboardPage navigateTo={navigateTo} />;
  }

  return (
    <div className={isLoggedIn ? 'logged-in' : 'logged-out'}>
      {/* Global Full-Screen 3D Smart City Background */}
      <SmartCityBackground />

      {/* Background Orbs */}
      <div className="bg-glow bg-glow-1"></div>
      <div className="bg-glow bg-glow-2"></div>
      <div className="bg-glow bg-glow-3"></div>

      {/* Header */}
      <header className="main-header">
        <div className="header-container">
          <a href="#" className="logo">
            <img src={newLogo} alt="Aculion Logo" className="logo-img" />
          </a>

          {(!user || (user.role !== 'Brand Advertiser' && user.role !== 'Administrator')) && (
            <nav className="nav-links">
              <a href="/" onClick={(e) => handleNavLinkClick(e, '/', 'hero')} className={`nav-item ${activeSection === 'hero' || activeSection === '' ? 'active' : ''}`}>Home</a>
              <a href="#features" onClick={(e) => handleNavLinkClick(e, '/', 'features')} className={`nav-item ${activeSection === 'features' ? 'active' : ''}`}>Features</a>
              <a href="#solutions" onClick={(e) => handleNavLinkClick(e, '/', 'solutions')} className={`nav-item ${activeSection === 'solutions' ? 'active' : ''}`}>Insights</a>
              <a href="#services" onClick={(e) => handleNavLinkClick(e, '/', 'services')} className={`nav-item ${activeSection === 'services' ? 'active' : ''}`}>Services</a>
              <a href="#about" onClick={(e) => handleNavLinkClick(e, '/', 'about')} className={`nav-item ${activeSection === 'about' ? 'active' : ''}`}>About Us</a>
              <a href="#contact-section" onClick={(e) => handleNavLinkClick(e, '/', 'contact-section')} className={`nav-item ${activeSection === 'contact-section' ? 'active' : ''}`}>Contact</a>
            </nav>
          )}

          <div className="auth-buttons">
            {!isLoggedIn ? (
              <>
                <button className="btn btn-demo" onClick={(e) => handleDemoNavigation(e)}>
                  <i className="fa-regular fa-calendar"></i>
                  <span>Book a Demo</span>
                </button>
                <button className="btn btn-primary" onClick={(e) => navigateTo(e, '/sign-in')}>Sign In</button>
              </>
            ) : (
              <div
                className={`user-profile-menu${dropdownOpen ? ' open' : ''}`}
                ref={dropdownRef}
                onMouseEnter={scheduleOpen}
                onMouseLeave={scheduleClose}
                onKeyDown={handleDropdownKeyDown}
              >
                {/* Trigger button */}
                <button
                  className="profile-info"
                  onClick={toggleDropdown}
                  aria-haspopup="true"
                  aria-expanded={dropdownOpen}
                  aria-label="Profile menu"
                >
                  <div className="profile-avatar"><i className="fa-solid fa-user"></i></div>
                  <span className="profile-name">
                    {user?.name ? user.name.charAt(0).toUpperCase() + user.name.slice(1) : 'User'}
                  </span>
                  <i className={`fa-solid fa-chevron-down profile-arrow${dropdownOpen ? ' rotated' : ''}`}></i>
                </button>

                {/* Invisible bridge: fills the gap so mouse can travel from button → menu */}
                {dropdownOpen && (
                  <div
                    className="dropdown-bridge"
                    onMouseEnter={cancelClose}
                    onMouseLeave={scheduleClose}
                  />
                )}

                {/* Dropdown panel */}
                <div
                  className={`profile-dropdown${dropdownOpen ? ' visible' : ''}`}
                  role="menu"
                  aria-label="User menu"
                  onMouseEnter={cancelClose}
                  onMouseLeave={scheduleClose}
                >
                  <a
                    href="/dashboard"
                    className="dropdown-item"
                    role="menuitem"
                    tabIndex={dropdownOpen ? 0 : -1}
                    onClick={(e) => { e.preventDefault(); setDropdownOpen(false); navigateTo(e, '/dashboard'); }}
                  >
                    <i className="fa-solid fa-chart-line"></i> Dashboard
                  </a>
                  <button
                    className="dropdown-item danger-item w-full"
                    role="menuitem"
                    tabIndex={dropdownOpen ? 0 : -1}
                    onClick={handleLogout}
                  >
                    <i className="fa-solid fa-arrow-right-from-bracket"></i> Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>

          {(!user || (user.role !== 'Brand Advertiser' && user.role !== 'Administrator')) && (
            <button className="mobile-menu-toggle" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
              <i className={`fa-solid ${mobileMenuOpen ? 'fa-xmark' : 'fa-bars-staggered'}`}></i>
            </button>
          )}
        </div>
      </header>

      {/* Mobile nav drawer */}
      {(!user || (user.role !== 'Brand Advertiser' && user.role !== 'Administrator')) && mobileMenuOpen && (
        <div className="mobile-nav open">
          <a href="/" className={`mobile-nav-item ${activeSection === 'hero' || activeSection === '' ? 'active' : ''}`} onClick={(e) => { setMobileMenuOpen(false); handleNavLinkClick(e, '/', 'hero'); }}>Home</a>
          <a href="#features" className={`mobile-nav-item ${activeSection === 'features' ? 'active' : ''}`} onClick={(e) => { setMobileMenuOpen(false); handleNavLinkClick(e, '/', 'features'); }}>Features</a>
          <a href="#solutions" className={`mobile-nav-item ${activeSection === 'solutions' ? 'active' : ''}`} onClick={(e) => { setMobileMenuOpen(false); handleNavLinkClick(e, '/', 'solutions'); }}>Insights</a>
          <a href="#services" className={`mobile-nav-item ${activeSection === 'services' ? 'active' : ''}`} onClick={(e) => { setMobileMenuOpen(false); handleNavLinkClick(e, '/', 'services'); }}>Services</a>
          <a href="#about" className={`mobile-nav-item ${activeSection === 'about' ? 'active' : ''}`} onClick={(e) => { setMobileMenuOpen(false); handleNavLinkClick(e, '/', 'about'); }}>About Us</a>
          <a href="#contact-section" className={`mobile-nav-item ${activeSection === 'contact-section' ? 'active' : ''}`} onClick={(e) => { setMobileMenuOpen(false); handleNavLinkClick(e, '/', 'contact-section'); }}>Contact</a>
          <div className="mobile-auth-buttons">
            {!isLoggedIn ? (
              <>
                <button className="btn btn-demo w-full" onClick={(e) => { handleDemoNavigation(e); setMobileMenuOpen(false); }}>
                  <i className="fa-regular fa-calendar"></i>
                  <span>Book a Demo</span>
                </button>
                <button className="btn btn-primary w-full" onClick={(e) => { navigateTo(e, '/sign-in'); setMobileMenuOpen(false); }}>Sign In</button>
              </>
            ) : (
              <button className="btn btn-outline w-full" onClick={() => { handleLogout(); setMobileMenuOpen(false); }}>Sign Out</button>
            )}
          </div>
        </div>
      )}

      {/* Logged Out View Gateway */}
      {user?.role === 'Brand Advertiser' ? (
        /* Brand Advertiser Portal */
        <BrandPortal user={user} onLogout={handleLogout} />
      ) : (
        /* Logged Out / Media Owner View */
        <main className="fade-in-content">
          {route === '/media-owner' ? (
            <MediaOwnerPage
              navigateTo={navigateTo}
              isLoggedIn={isLoggedIn}
              setShowRegister={setShowRegister}
              setShowSignin={(val) => {
                if (val) {
                  navigateTo(null, '/sign-in');
                }
              }}
              handleLogout={handleLogout}
              user={user}
            />
          ) : route === '/sign-in' ? (
            <SignInPage
              navigateTo={navigateTo}
              isLoggedIn={isLoggedIn}
              user={user}
              authErrorMessage={authErrorMessage}
              onLoginSuccess={(u) => {
                setUser(u);
                setIsLoggedIn(true);
                const target = '/media-profile';
                window.history.pushState(null, '', target);
                setRoute(target);
              }}
            />
          ) : route === '/forgot-password' ? (
            <div className="signin-page-wrapper">
              <div className="signin-card glass-panel" style={{ textAlign: 'center' }}>
                <div className="signin-logo-container">
                  <img src={newLogo} alt="Aculion" className="signin-logo-img" />
                </div>
                <h2 className="signin-title" style={{ fontSize: '20px', marginBottom: '16px' }}>Forgot Password</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '14px', lineHeight: '1.6', marginBottom: '24px' }}>
                  Please contact system administration to reset your password.
                </p>
                <button className="btn btn-primary w-full" onClick={(e) => navigateTo(e, '/sign-in')}>
                  Back to Sign In
                </button>
              </div>
            </div>
          ) : (

            <>
              {/* Hero Section */}
              <section id="hero" className="hero-section">
                <div className="section-container hero-container">
                  <div className="hero-content">
                    <div className="hero-accent">
                      <span className="accent-line"></span>
                      <span className="accent-pulse"></span>
                    </div>
                    <div className="hero-title-container">
                      <div className="hero-title-glow"></div>
                      <h1 className="hero-title">The Intelligence<br />Layer for<br />Outdoor<br /><span className="text-gradient">Advertising</span></h1>
                    </div>
                    <p className="hero-subtitle">
                      Aculion is an independent data intelligence provider measuring attention, traffic, and campaign performance across physical billboards in real-time—delivering complete transparency and measurable ROI to outdoor advertising.
                    </p>
                  </div>
                  <HeroCityAnalytics />
                </div>
              </section>

              {/* Metrics bar */}
              <section className="metrics-bar">
                <div className="section-container metrics-container">
                  <div className="metric-item">
                    <h3 className="metric-value">150+</h3>
                    <p className="metric-label"> Active Production Tests</p>
                  </div>
                  <div className="metric-divider"></div>
                  <div className="metric-item">
                    <h3 className="metric-value">10K+</h3>
                    <p className="metric-label">Real-World Traffic Intelligence</p>
                  </div>
                  <div className="metric-divider"></div>
                  <div className="metric-item">
                    <h3 className="metric-value">82,000+</h3>
                    <p className="metric-label">Points of Interest (POIs)</p>
                  </div>
                  <div className="metric-divider"></div>
                  <div className="metric-item">
                    <h3 className="metric-value">92.7%</h3>
                    <p className="metric-label">Vehicle Classification Accuracy</p>
                  </div>
                  <div className="metric-divider"></div>
                  <div className="metric-item">
                    <h3 className="metric-value">100%</h3>
                    <p className="metric-label">Privacy Secure</p>
                  </div>
                </div>
              </section>

              {/* ESOMAR Member Trust Section */}
              <section className="esomar-trust-section">
                <div className="esomar-fade-top"></div>
                <div className="section-container esomar-inner">
                  <div className="esomar-card">
                    <div className="esomar-icon-wrap">
                      <i className="fa-solid fa-shield-halved esomar-icon"></i>
                    </div>
                    <span className="esomar-badge">GLOBAL RESEARCH COMMITMENT</span>
                    <p className="esomar-description">
                      Aculion follows internationally recognized research methodologies inspired by ESOMAR's ethical framework while our membership application is in progress.
                    </p>
                  </div>
                </div>
                <div className="esomar-fade-bottom"></div>
              </section>

              {/* Features Pillar */}
              <section id="features" className="features-section">
                <div className="section-container">
                  <div className="section-header">
                    <span className="section-tag">Key Pillars</span>
                    <h2 className="section-title">Apex-Tier Analytics</h2>
                    <p className="section-desc">High-performance AI designed to process complex physical footprints with clinical precision, safeguarding privacy while uncovering absolute truth.</p>
                  </div>
                  <div className="features-grid">
                    <div className="feature-card">
                      <div className="card-shine"></div>
                      <div className="feature-icon"><i className="fa-solid fa-person-walking"></i></div>
                      <h3 className="feature-title">Traffic Intelligence</h3>
                      <p className="feature-text">Real-time movement intelligence for every road, intersection, and billboard.</p>
                    </div>
                    <div className="feature-card cursor-pointer" onClick={(e) => navigateTo(e, '/location-intelligence')} style={{ cursor: 'pointer' }}>
                      <div className="card-shine"></div>
                      <div className="feature-icon"><i className="fa-solid fa-eye"></i></div>
                      <h3 className="feature-title">Location Intelligence</h3>
                      <p className="feature-text">Deep contextual intelligence about where your media exists.</p>
                    </div>
                    <div className="feature-card">
                      <div className="card-shine"></div>
                      <div className="feature-icon"><i className="fa-solid fa-hourglass-half"></i></div>
                      <h3 className="feature-title">Audience Intelligence</h3>
                      <p className="feature-text">Understand who sees your media and how valuable that audience is</p>
                    </div>
                  </div>
                </div>
              </section>

              {/* Solutions Section */}
              {/* id="insights" alias lets the #insights hash and old references still work */}
              <span id="insights" aria-hidden="true" style={{ position: 'absolute', pointerEvents: 'none' }}></span>
              <section id="solutions" className="solutions-section pt-28 sm:pt-32 lg:pt-[100px] scroll-mt-20">
                <div className="section-container">
                  <div className="section-header relative" style={{ zIndex: 10 }}>
                    <span className="section-tag">Solutions</span>
                    <h2 className="section-title text-4xl sm:text-5xl lg:text-[40px]">Insights That Drive Better Decisions.</h2>
                    <p className="section-desc mt-5 lg:mt-0">Purpose-built, data-driven solutions for media owners and billboard operators.</p>
                  </div>

                  {/* Tab Content: Media Owners */}
                  <div className="solutions-tab-content active">
                    <div className="solutions-intro-card glass-panel">
                      <div className="solutions-intro-icon" style={{ color: '#00f0ff' }}>
                        <i className="fa-solid fa-circle-nodes"></i>
                      </div>
                      <div className="solutions-intro-text">
                        <h3>Every Billboard Has Value. Aculion Helps You Prove It.</h3>
                        <p>For decades, outdoor advertising has relied on estimates instead of evidence. Aculion changes that by transforming every billboard into a measurable, data-driven advertising asset. With real-time traffic, location, and audience insights, media owners can measure performance, optimize inventory utilization, and make smarter pricing decisions.</p>
                        <ul className="solutions-intro-list">
                          <li>
                            <i className="fa-solid fa-circle-check text-cyan"></i>
                            <span>AI-powered traffic and audience intelligence.</span>
                          </li>
                          <li>
                            <i className="fa-solid fa-circle-check text-cyan"></i>
                            <span>Monthly performance reports, available anytime.</span>
                          </li>
                          <li>
                            <i className="fa-solid fa-circle-check text-cyan"></i>
                            <span>Premium listing to attract more advertisers.</span>
                          </li>
                          <li>
                            <i className="fa-solid fa-circle-check text-cyan"></i>
                            <span>Receive direct enquiries from potential advertisers.</span>
                          </li>
                          <li>
                            <i className="fa-solid fa-circle-check text-cyan"></i>
                            <span>Data-backed pricing instead of assumptions.</span>
                          </li>
                          <li>
                            <i className="fa-solid fa-circle-check text-cyan"></i>
                            <span>Turn digital screens into programmatic-ready assets.</span>
                          </li>
                        </ul>
                      </div>
                    </div>

                    <h3 className="solutions-grid-title">Why Media Owners Choose Aculion</h3>
                    <div className="solutions-grid">
                      {[
                        { title: "Increase Advertiser Confidence", desc: "Help advertisers make informed buying decisions by providing transparent, measurable media performance.", icon: "fa-shield-heart" },
                        { title: "Price with Confidence", desc: "Replace guesswork with real intelligence when determining media rates and negotiating campaigns.", icon: "fa-tags" },
                        { title: "Future-Ready Infrastructure", desc: "Prepare your media assets for data-driven and programmatic outdoor advertising as the industry evolves.", icon: "fa-network-wired" },
                        { title: "Turn Data into Revenue", desc: "Demonstrate the true value of your locations with verified traffic intelligence and performance analytics.", icon: "fa-sack-dollar" },
                        { title: "Premium Media Listings", desc: "Stand out on the Aculion platform with verified performance data, making your inventory more discoverable to premium advertisers.", icon: "fa-star" },
                        { title: "Generate Qualified Sales Leads", desc: "Advertisers can discover your media inventory and connect with you directly—bringing new business opportunities without intermediaries.", icon: "fa-envelope-open-text" },
                        { title: "Monthly Performance Reports", desc: "Download professionally designed reports anytime, complete with historical trends and performance insights.", icon: "fa-file-invoice-dollar" },
                        { title: "Understand Your Audience", desc: "Measure traffic volume, vehicle mix, peak hours, dwell patterns, and other key intelligence that helps explain why a location performs.", icon: "fa-chart-pie" },
                      ].map((item, idx) => (
                        <div className="solutions-card glass-panel" key={idx}>
                          <div className="solutions-card-icon"><i className={`fa-solid ${item.icon}`}></i></div>
                          <h4>{item.title}</h4>
                          <p>{item.desc}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Why Aculion Exists Section */}
                  <div className="manifesto-section glass-panel">
                    <div className="manifesto-glow"></div>
                    <div className="manifesto-header">
                      <span className="manifesto-tag">Why Aculion Exists</span>
                      <h3 className="manifesto-title">From Assumptions to <span className="text-gradient">Intelligence</span></h3>
                      <p className="manifesto-desc">Outdoor advertising deserves the same level of measurement and accountability as digital advertising. Aculion is building the independent intelligence platform that empowers every outdoor advertising decision with trusted, AI-driven insights.</p>
                    </div>
                    <div className="manifesto-grid">
                      {[
                        { title: "Real-Time Intelligence", desc: "Measure live traffic, audience, and location insights with AI-powered computer vision.", icon: "fa-bolt", color: "#00f0ff" },
                        { title: "Independent Measurement", desc: "Access transparent, third-party analytics to verify campaign delivery and media performance.", icon: "fa-shield-halved", color: "#8b5cf6" },
                        { title: "Smarter Inventory Planning", desc: "Compare locations, predict campaign performance, and optimize inventory allocation for maximum yield.", icon: "fa-compass", color: "#0052ff" },
                        { title: "Actionable Insights", desc: "Turn complex data into clear recommendations that help maximize campaign performance and ROI.", icon: "fa-chart-line", color: "#10b981" }
                      ].map((item, idx) => (
                        <div className="manifesto-card" key={idx}>
                          <div className="manifesto-card-icon" style={{ color: item.color }}><i className={`fa-solid ${item.icon}`}></i></div>
                          <h4>{item.title}</h4>
                          <p>{item.desc}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              </section>

              {/* ═══════════════════════════════════════════════════════════════
               INTERACTIVE DASHBOARD PREVIEW — Full-Width Mockup
          ═══════════════════════════════════════════════════════════════ */}
              <section id="dashboard-section" className="dashboard-section" style={{ padding: '80px 0 60px' }}>
                <div className="section-container" style={{ maxWidth: '1360px' }}>

                  {/* Section Header */}
                  <div className="section-header" style={{ textAlign: 'center', marginBottom: '48px' }}>
                    <span className="section-tag">Live Intelligence Platform</span>
                    <h2 className="section-title">Experience ACULION Live Intelligence</h2>
                    <p className="section-desc" style={{ maxWidth: '680px', margin: '0 auto' }}>
                      Explore real-time location intelligence powered by AE. Monitor live traffic movement, vehicle density, dwell time, heatmaps, and location performance through our enterprise analytics dashboard.
                    </p>
                  </div>

                  {/* ── Dashboard Mockup Container ── */}
                  <div style={{
                    position: 'relative',
                    borderRadius: '16px',
                    border: '1px solid rgba(255,255,255,0.08)',
                    background: 'linear-gradient(135deg, rgba(8,12,22,0.95), rgba(10,14,26,0.98))',
                    backdropFilter: 'blur(20px)',
                    boxShadow: '0 0 60px rgba(59,130,246,0.08), 0 25px 80px rgba(0,0,0,0.6)',
                    overflow: 'hidden',
                    fontFamily: "'Inter', sans-serif"
                  }}>

                    {/* Ambient glow overlays */}
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'radial-gradient(ellipse at 30% 20%, rgba(59,130,246,0.06), transparent 60%)', pointerEvents: 'none', zIndex: 0 }} />
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'radial-gradient(ellipse at 80% 80%, rgba(99,102,241,0.04), transparent 60%)', pointerEvents: 'none', zIndex: 0 }} />

                    {/* ── MOCK TOP BAR ── */}
                    <div style={{
                      height: '48px', borderBottom: '1px solid rgba(255,255,255,0.06)',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '0 20px', background: 'rgba(8,12,22,0.7)', position: 'relative', zIndex: 1
                    }}>


                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '10px', fontWeight: 600, color: 'rgba(255,255,255,0.8)', letterSpacing: '0.01em' }}>Anna Nagar – Shanthi Colony Junction</span>
                        <span style={{ padding: '1px 6px', borderRadius: '4px', fontSize: '7px', fontWeight: 700, background: 'rgba(34,197,94,0.12)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.2)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                          <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#22c55e', animation: 'pulse 2s ease-in-out infinite' }} />
                          LIVE
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.45)', background: 'rgba(255,255,255,0.03)', padding: '3px 8px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.05)' }}>📅 08 Jul 2025</span>
                        <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.45)', background: 'rgba(255,255,255,0.03)', padding: '3px 8px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.05)', fontFamily: 'monospace' }}>🕐 10:24:35 AM</span>
                      </div>
                    </div>

                    {/* ── BODY: SIDEBAR + MAIN ── */}
                    <div style={{ display: 'flex', position: 'relative', zIndex: 1 }}>

                      {/* Sidebar */}
                      <div style={{
                        width: '170px', borderRight: '1px solid rgba(255,255,255,0.05)',
                        background: 'rgba(8,11,21,0.5)', padding: '12px 8px', flexShrink: 0,
                        display: 'flex', flexDirection: 'column', gap: '3px'
                      }}>
                        <span style={{ fontSize: '7px', fontWeight: 700, letterSpacing: '0.15em', color: 'rgba(255,255,255,0.2)', textTransform: 'uppercase', padding: '0 8px 6px' }}>Location Intelligence</span>
                        {[
                          { icon: 'fa-circle-dot', label: 'Live View', active: true }
                        ].map((item, idx) => (
                          <div key={idx} style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            padding: '6px 10px', borderRadius: '6px',
                            background: item.active ? '#2563eb' : 'rgba(255,255,255,0.02)',
                            border: item.active ? '1px solid rgba(96,165,250,0.3)' : '1px solid transparent',
                            color: item.active ? 'white' : 'rgba(255,255,255,0.35)',
                            fontSize: '9px', fontWeight: item.active ? 600 : 500,
                            transition: 'all 0.2s',
                            boxShadow: item.active ? '0 0 12px rgba(37,99,235,0.3)' : 'none'
                          }}>
                            <i className={`fa-solid ${item.icon}`} style={{ width: '12px', textAlign: 'center', fontSize: '8px' }} />
                            <span>{item.label}</span>
                          </div>
                        ))}

                        {/* Selected Location mini-card */}
                        <div style={{ marginTop: 'auto', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                          <span style={{ fontSize: '6.5px', fontWeight: 700, letterSpacing: '0.15em', color: 'rgba(255,255,255,0.2)', textTransform: 'uppercase', display: 'block', marginBottom: '4px', paddingLeft: '4px' }}>Selected Location</span>
                          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px', padding: '8px', fontSize: '8px' }}>
                            <div style={{ fontWeight: 700, color: 'rgba(255,255,255,0.8)', marginBottom: '2px' }}>Anna Nagar</div>
                            <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '7px', lineHeight: '1.3' }}>Shanthi Colony Junction,<br />Chennai - 600040</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#22c55e', fontSize: '7px', fontWeight: 600, marginTop: '4px' }}>
                              <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#22c55e' }} />
                              Live Since 09:12:45 AM
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Main Content Area */}
                      <div style={{ flex: 1, padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px', minWidth: 0 }}>

                        {/* KPI CARDS ROW */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px' }}>
                          {[
                            { label: 'People Count (Now)', value: '1,246', change: '↑ 18.6%', icon: 'fa-person-walking', iconColor: '#3b82f6', iconBg: 'rgba(59,130,246,0.1)' },
                            { label: 'Vehicles Count (Now)', value: '862', change: '↑ 12.4%', icon: 'fa-car', iconColor: '#06b6d4', iconBg: 'rgba(6,182,212,0.1)' },
                            { label: 'Avg. Dwell Time', value: '38 sec', change: '↑ 6.3%', icon: 'fa-clock', iconColor: '#8b5cf6', iconBg: 'rgba(139,92,246,0.1)' },
                            { label: 'Peak Time Today', value: '6–8 PM', sub: 'Highest volume', icon: 'fa-chart-simple', iconColor: '#a78bfa', iconBg: 'rgba(167,139,250,0.1)' },
                            { label: 'Location Score', value: '87', suffix: '/100', badge: 'High Potential', icon: 'fa-star', iconColor: '#f59e0b', iconBg: 'rgba(245,158,11,0.1)' }
                          ].map((kpi, idx) => (
                            <div key={idx} style={{
                              background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(255,255,255,0.06)',
                              borderRadius: '8px', padding: '10px', display: 'flex', alignItems: 'center', gap: '8px'
                            }}>
                              <div style={{
                                width: '28px', height: '28px', borderRadius: '6px',
                                background: kpi.iconBg, border: `1px solid ${kpi.iconColor}30`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: kpi.iconColor, fontSize: '10px', flexShrink: 0
                              }}>
                                <i className={`fa-solid ${kpi.icon}`} />
                              </div>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: '7px', color: 'rgba(255,255,255,0.3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{kpi.label}</div>
                                <div style={{ display: 'flex', alignItems: 'baseline', gap: '2px', marginTop: '2px' }}>
                                  <span style={{ fontSize: '14px', fontWeight: 800, color: 'white', lineHeight: 1 }}>{kpi.value}</span>
                                  {kpi.suffix && <span style={{ fontSize: '8px', color: 'rgba(255,255,255,0.3)' }}>{kpi.suffix}</span>}
                                </div>
                                {kpi.change && <span style={{ fontSize: '7px', color: '#22c55e', fontWeight: 700, marginTop: '2px', display: 'block' }}>{kpi.change} <span style={{ color: 'rgba(255,255,255,0.15)', fontWeight: 500 }}>vs yesterday</span></span>}
                                {kpi.badge && <span style={{ fontSize: '6px', color: '#22c55e', fontWeight: 700, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', padding: '1px 4px', borderRadius: '3px', marginTop: '2px', display: 'inline-block', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{kpi.badge}</span>}
                                {kpi.sub && <span style={{ fontSize: '7px', color: 'rgba(255,255,255,0.2)', display: 'block', marginTop: '1px' }}>{kpi.sub}</span>}
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* MAP + RIGHT PANEL ROW */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1fr', gap: '10px', flex: 1, minHeight: '220px' }}>

                          {/* Map Panel */}
                          <div style={{
                            background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(255,255,255,0.06)',
                            borderRadius: '8px', overflow: 'hidden', position: 'relative'
                          }}>
                            <div style={{ padding: '6px 12px', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '9px', fontWeight: 700, color: 'rgba(255,255,255,0.7)' }}>Live Location Intelligence</div>
                            <div style={{ position: 'relative', height: '200px', background: 'linear-gradient(135deg, #070a13, #0d1424)' }}>
                              <svg width="100%" height="100%" viewBox="0 0 500 200" preserveAspectRatio="xMidYMid slice">
                                <defs>
                                  <filter id="blueGlow" x="-50%" y="-50%" width="200%" height="200%">
                                    <feGaussianBlur stdDeviation="5" result="blur" />
                                    <feMerge>
                                      <feMergeNode in="blur" />
                                      <feMergeNode in="SourceGraphic" />
                                    </feMerge>
                                  </filter>
                                  <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
                                    <path d="M 30 0 L 0 0 0 30" fill="none" stroke="rgba(255, 255, 255, 0.015)" strokeWidth="1" />
                                  </pattern>
                                </defs>

                                <rect width="100%" height="100%" fill="url(#grid)" />

                                {/* Self-contained animations inside SVG */}
                                <style>
                                  {`
                                @keyframes flowEast { to { stroke-dashoffset: -20; } }
                                @keyframes flowWest { to { stroke-dashoffset: 20; } }
                                @keyframes flowSouth { to { stroke-dashoffset: -20; } }
                                @keyframes flowNorth { to { stroke-dashoffset: 20; } }
                                
                                .flow-east { animation: flowEast 1.5s linear infinite; }
                                .flow-west { animation: flowWest 1.5s linear infinite; }
                                .flow-south { animation: flowSouth 1.8s linear infinite; }
                                .flow-north { animation: flowNorth 1.8s linear infinite; }
                              `}
                                </style>

                                {/* Road Outlines ( Slate-800 bodies ) */}
                                <path d="M -50,100 L 550,100" stroke="#131b2e" strokeWidth="12" fill="none" />
                                <path d="M 250,-50 L 250,250" stroke="#131b2e" strokeWidth="12" fill="none" />
                                <path d="M -50,-20 L 550,220" stroke="#131b2e" strokeWidth="10" fill="none" />
                                <path d="M 550,-20 L -50,220" stroke="#131b2e" strokeWidth="10" fill="none" />
                                <path d="M 110,-50 L 110,250" stroke="#131b2e" strokeWidth="8" fill="none" />
                                <path d="M 390,-50 L 390,250" stroke="#131b2e" strokeWidth="8" fill="none" />

                                {/* Road Lanes ( dashed center lines ) */}
                                <path d="M -50,100 L 550,100" stroke="rgba(255,255,255,0.08)" strokeWidth="1" strokeDasharray="3 3" fill="none" />
                                <path d="M 250,-50 L 250,250" stroke="rgba(255,255,255,0.08)" strokeWidth="1" strokeDasharray="3 3" fill="none" />
                                <path d="M -50,-20 L 550,220" stroke="rgba(255,255,255,0.06)" strokeWidth="1" strokeDasharray="3 3" fill="none" />
                                <path d="M 550,-20 L -50,220" stroke="rgba(255,255,255,0.06)" strokeWidth="1" strokeDasharray="3 3" fill="none" />

                                {/* Glowing Active Traffic Flows */}
                                <path d="M -50,100 L 550,100" stroke="rgba(59, 130, 246, 0.25)" strokeWidth="1.5" strokeDasharray="8 8" fill="none" className="flow-east" />
                                <path d="M 250,-50 L 250,250" stroke="rgba(59, 130, 246, 0.2)" strokeWidth="1.5" strokeDasharray="8 8" fill="none" className="flow-south" />
                                <path d="M -50,-20 L 550,220" stroke="rgba(34, 197, 94, 0.2)" strokeWidth="1.2" strokeDasharray="6 6" fill="none" className="flow-east" />

                                {/* Concentric Geofence Rings */}
                                <circle cx="250" cy="100" r="30" fill="none" stroke="rgba(59, 130, 246, 0.25)" strokeWidth="0.8" strokeDasharray="3 3" />
                                <circle cx="250" cy="100" r="60" fill="none" stroke="rgba(59, 130, 246, 0.15)" strokeWidth="0.8" />
                                <circle cx="250" cy="100" r="90" fill="none" stroke="rgba(59, 130, 246, 0.08)" strokeWidth="0.8" strokeDasharray="5 5" />

                                {/* Glowing Geofence Diamond Star Boundary */}
                                <path
                                  d="M 250,100 L 130,96 Q 200,100 250,150 Q 250,110 370,110 Q 290,105 250,50 Q 235,85 130,96"
                                  fill="rgba(37, 99, 235, 0.1)"
                                  stroke="#2563eb"
                                  strokeWidth="1.2"
                                  filter="url(#blueGlow)"
                                />

                                {/* Animated Density Points (Pedestrian & Vehicle activity flows) */}
                                {/* Road 1: N-S */}
                                <circle r="2.5" fill="#ef4444"><animateMotion dur="10s" repeatCount="indefinite" path="M 250,-20 L 250,220" begin="0s" /></circle>
                                <circle r="2.5" fill="#22c55e"><animateMotion dur="14s" repeatCount="indefinite" path="M 250,220 L 250,-20" begin="-3s" /></circle>
                                <circle r="2" fill="#3b82f6"><animateMotion dur="12s" repeatCount="indefinite" path="M 250,-20 L 250,220" begin="-6s" /></circle>
                                {/* Road 2: E-W */}
                                <circle r="3" fill="#ef4444"><animateMotion dur="8s" repeatCount="indefinite" path="M -20,100 L 520,100" begin="-1s" /></circle>
                                <circle r="2.2" fill="#eab308"><animateMotion dur="11s" repeatCount="indefinite" path="M 520,100 L -20,100" begin="-4s" /></circle>
                                <circle r="2.8" fill="#f97316"><animateMotion dur="9s" repeatCount="indefinite" path="M -20,100 L 520,100" begin="-7s" /></circle>
                                {/* Road 3: NW-SE */}
                                <circle r="2.5" fill="#22c55e"><animateMotion dur="12s" repeatCount="indefinite" path="M -20,-10 L 520,210" begin="-2s" /></circle>
                                <circle r="2" fill="#ef4444"><animateMotion dur="15s" repeatCount="indefinite" path="M 520,210 L -20,-10" begin="-5s" /></circle>
                                {/* Road 4: NE-SW */}
                                <circle r="2.5" fill="#3b82f6"><animateMotion dur="11s" repeatCount="indefinite" path="M 520,-10 L -20,210" begin="0s" /></circle>
                                <circle r="3" fill="#eab308"><animateMotion dur="13s" repeatCount="indefinite" path="M -20,210 L 520,-10" begin="-8s" /></circle>

                                {/* Street & Landmark Labels */}
                                <g fontSize="7.5" fontFamily="Inter, sans-serif" fill="rgba(255,255,255,0.3)" fontWeight="500">
                                  <text x="80" y="45" textAnchor="middle">Anna Nagar West</text>
                                  <text x="80" y="165" textAnchor="middle">Shanthi Colony</text>
                                  <text x="375" y="175" textAnchor="middle">Anna Nagar East</text>
                                  <text x="365" y="60" textAnchor="middle">PVR VR Mall</text>
                                  <text x="420" y="130" textAnchor="middle">Anna Nagar Tower</text>
                                  <text x="415" y="80" textAnchor="middle">Blue Star</text>
                                  <text x="285" y="30" textAnchor="middle">Roundtana</text>

                                  <text x="330" y="145" fill="rgba(255,255,255,0.18)" fontSize="6.5" transform="rotate(22, 330, 145)">Arya Gowda Road</text>
                                  <text x="60" y="108" fill="rgba(255,255,255,0.18)" fontSize="6.5">Shanthi Ave</text>
                                </g>

                                {/* Glowing central anchor pin */}
                                <g transform="translate(250, 100)">
                                  <circle cx="0" cy="0" r="14" fill="rgba(59,130,246,0.15)" stroke="rgba(59,130,246,0.4)" strokeWidth="1" />
                                  <circle cx="0" cy="0" r="5" fill="#2563eb" stroke="white" strokeWidth="1.5" />
                                  <circle cx="0" cy="0" r="1.5" fill="white" />
                                </g>
                              </svg>

                              {/* Camera tag */}
                              <div style={{ position: 'absolute', bottom: '10px', left: '10px', background: 'rgba(10,15,29,0.92)', border: '1px solid rgba(255,255,255,0.08)', padding: '3px 8px', borderRadius: '4px', fontSize: '7.5px', color: 'rgba(255,255,255,0.6)', display: 'flex', alignItems: 'center', gap: '4px', backdropFilter: 'blur(4px)', shadow: '0 2px 8px rgba(0,0,0,0.5)' }}>
                                Camera 1
                                <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#22c55e' }} />
                                <span style={{ color: '#22c55e', fontWeight: 700, fontSize: '6.5px', letterSpacing: '0.1em' }}>LIVE</span>
                              </div>

                              {/* Density legend */}
                              <div style={{ position: 'absolute', top: '10px', right: '10px', background: 'rgba(10,15,29,0.92)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', padding: '5px 8px', display: 'flex', flexDirection: 'column', gap: '2px', backdropFilter: 'blur(4px)', shadow: '0 2px 8px rgba(0,0,0,0.5)' }}>
                                <span style={{ fontSize: '6.5px', fontWeight: 600, color: 'rgba(255,255,255,0.4)' }}>Live Density (People/min)</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <span style={{ fontSize: '6px', color: 'rgba(255,255,255,0.3)' }}>Low</span>
                                  <div style={{ width: '60px', height: '4px', borderRadius: '2px', background: 'linear-gradient(to right, #3b82f6, #10b981, #eab308, #f97316, #ef4444)' }} />
                                  <span style={{ fontSize: '6px', color: 'rgba(255,255,255,0.3)' }}>High</span>
                                </div>
                              </div>

                              {/* Zoom controls */}
                              <div style={{ position: 'absolute', bottom: '10px', right: '10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <button style={{ width: '20px', height: '20px', borderRadius: '3px', background: 'rgba(10,15,29,0.92)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', shadow: '0 2px 6px rgba(0,0,0,0.4)' }}>+</button>
                                <button style={{ width: '20px', height: '20px', borderRadius: '3px', background: 'rgba(10,15,29,0.92)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', shadow: '0 2px 6px rgba(0,0,0,0.4)' }}>−</button>
                                <button style={{ width: '20px', height: '20px', borderRadius: '3px', background: 'rgba(10,15,29,0.92)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', shadow: '0 2px 6px rgba(0,0,0,0.4)' }}>
                                  <i className="fa-solid fa-crosshairs"></i>
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Right stacked panels */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {/* Camera Feed */}
                            <div style={{
                              background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(255,255,255,0.06)',
                              borderRadius: '8px', overflow: 'hidden', height: '110px'
                            }}>
                              <div style={{ padding: '5px 10px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '8px', fontWeight: 700, color: 'rgba(255,255,255,0.7)' }}>Live Camera Feed</span>
                                <span style={{ padding: '1px 5px', borderRadius: '3px', fontSize: '6.5px', fontWeight: 700, background: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.2)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                  <span style={{ width: '3px', height: '3px', borderRadius: '50%', background: '#22c55e', animation: 'pulse 2s ease-in-out infinite' }} />
                                  LIVE
                                </span>
                              </div>
                              <div style={{ height: 'calc(100% - 26px)', background: '#000', position: 'relative' }}>
                                <img src="/anna_nagar_feed.png" alt="Camera Feed" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.75 }} />
                              </div>
                            </div>

                            {/* Location Summary */}
                            <div style={{
                              background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(255,255,255,0.06)',
                              borderRadius: '8px', flex: 1, overflow: 'hidden'
                            }}>
                              <div style={{ padding: '5px 10px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                <span style={{ fontSize: '8px', fontWeight: 700, color: 'rgba(255,255,255,0.7)' }}>Location Summary <span style={{ color: 'rgba(255,255,255,0.25)', fontWeight: 500 }}>(Today)</span></span>
                              </div>
                              <div style={{ padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                {[
                                  { icon: 'fa-person-walking', color: '#3b82f6', label: 'Total People', val: '45,782', change: '↑ 16.8%' },
                                  { icon: 'fa-car', color: '#06b6d4', label: 'Total Vehicles', val: '32,605', change: '↑ 11.3%' },
                                  { icon: 'fa-clock', color: '#8b5cf6', label: 'Avg. Dwell Time', val: '38 sec', change: '↑ 6.3%' },
                                  { icon: 'fa-chart-line', color: '#a78bfa', label: 'Peak Hour', val: '6–8 PM' },
                                  { icon: 'fa-calendar-days', color: '#f59e0b', label: 'Busiest Day', val: 'Friday' }
                                ].map((row, i) => (
                                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '3px 6px', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '4px', fontSize: '8px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'rgba(255,255,255,0.45)' }}>
                                      <i className={`fa-solid ${row.icon}`} style={{ color: row.color, fontSize: '8px', width: '12px', textAlign: 'center' }} />
                                      <span>{row.label}</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                      <span style={{ fontWeight: 700, color: 'white' }}>{row.val}</span>
                                      {row.change && <span style={{ fontSize: '7px', color: '#22c55e', fontWeight: 700 }}>{row.change}</span>}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>

                        </div>

                        {/* CHARTS ROW */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>

                          {/* People Count Trend */}
                          <div style={{ background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '10px', height: '140px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                              <span style={{ fontSize: '8px', fontWeight: 700, color: 'rgba(255,255,255,0.7)' }}>People Count Trend</span>
                              <span style={{ fontSize: '7px', color: 'rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.02)', padding: '2px 6px', borderRadius: '3px', border: '1px solid rgba(255,255,255,0.05)' }}>Today ▾</span>
                            </div>
                            <svg width="100%" height="95" viewBox="0 0 300 95" preserveAspectRatio="none">
                              <defs>
                                <linearGradient id="prevArea" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.2" />
                                  <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                                </linearGradient>
                              </defs>
                              {/* Grid lines */}
                              {[20, 40, 60, 80].map(y => <line key={y} x1="0" y1={y} x2="300" y2={y} stroke="rgba(255,255,255,0.03)" />)}
                              {/* Y-axis labels */}
                              <text x="2" y="18" fill="rgba(255,255,255,0.2)" fontSize="5">2K</text>
                              <text x="2" y="38" fill="rgba(255,255,255,0.2)" fontSize="5">1.5K</text>
                              <text x="2" y="58" fill="rgba(255,255,255,0.2)" fontSize="5">1K</text>
                              <text x="2" y="78" fill="rgba(255,255,255,0.2)" fontSize="5">500</text>
                              <text x="2" y="93" fill="rgba(255,255,255,0.2)" fontSize="5">0</text>
                              {/* Area fill */}
                              <path d="M 20,88 L 50,90 80,92 110,82 140,60 170,38 200,48 230,42 260,28 280,22 295,40 L 295,95 20,95 Z" fill="url(#prevArea)" />
                              {/* Line */}
                              <path d="M 20,88 L 50,90 80,92 110,82 140,60 170,38 200,48 230,42 260,28 280,22 295,40" fill="none" stroke="#3b82f6" strokeWidth="1.5" />
                              {/* Tooltip dot */}
                              <circle cx="170" cy="38" r="3" fill="#3b82f6" stroke="white" strokeWidth="1">
                                <animate attributeName="r" values="2.5;4;2.5" dur="2s" repeatCount="indefinite" />
                              </circle>
                              {/* X labels */}
                              <text x="20" y="93" fill="rgba(255,255,255,0.2)" fontSize="5">12 AM</text>
                              <text x="110" y="93" fill="rgba(255,255,255,0.2)" fontSize="5">08 AM</text>
                              <text x="200" y="93" fill="rgba(255,255,255,0.2)" fontSize="5">04 PM</text>
                              <text x="280" y="93" fill="rgba(255,255,255,0.2)" fontSize="5">12 AM</text>
                            </svg>
                            {/* Tooltip annotation */}
                            <div style={{ position: 'relative' }}>
                              <div style={{ position: 'absolute', left: '52%', bottom: '55px', transform: 'translateX(-50%)', background: 'rgba(15,23,42,0.95)', border: '1px solid rgba(255,255,255,0.1)', padding: '2px 5px', borderRadius: '3px', fontSize: '6.5px', color: 'white', whiteSpace: 'nowrap', pointerEvents: 'none' }}>
                                <span style={{ color: 'rgba(255,255,255,0.4)' }}>10:00 AM</span> · <span style={{ fontWeight: 700 }}>1,246 People</span>
                              </div>
                            </div>
                          </div>

                          {/* Hourly Heatmap */}
                          <div style={{ background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '10px', height: '140px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                              <span style={{ fontSize: '8px', fontWeight: 700, color: 'rgba(255,255,255,0.7)' }}>Hourly Heatmap (People)</span>
                              <span style={{ fontSize: '7px', color: 'rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.02)', padding: '2px 6px', borderRadius: '3px', border: '1px solid rgba(255,255,255,0.05)' }}>Today ▾</span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, dIdx) => {
                                const heatRow = [
                                  [0.05, 0.08, 0.12, 0.22, 0.35, 0.48, 0.65, 0.72, 0.58, 0.32, 0.15, 0.08],
                                  [0.08, 0.05, 0.10, 0.25, 0.38, 0.52, 0.78, 0.85, 0.62, 0.35, 0.18, 0.10],
                                  [0.06, 0.07, 0.11, 0.24, 0.40, 0.55, 0.82, 0.95, 0.68, 0.38, 0.20, 0.12],
                                  [0.07, 0.06, 0.13, 0.26, 0.42, 0.50, 0.75, 0.88, 0.60, 0.34, 0.19, 0.09],
                                  [0.09, 0.08, 0.15, 0.30, 0.48, 0.65, 0.88, 0.92, 0.75, 0.42, 0.25, 0.15],
                                  [0.12, 0.10, 0.18, 0.35, 0.44, 0.48, 0.52, 0.58, 0.45, 0.30, 0.22, 0.18],
                                  [0.10, 0.08, 0.12, 0.20, 0.30, 0.35, 0.40, 0.45, 0.38, 0.25, 0.15, 0.10]
                                ][dIdx];
                                const getColor = (v) => {
                                  if (v < 0.15) return '#101626';
                                  if (v < 0.30) return '#1e3a8a';
                                  if (v < 0.45) return '#2563eb';
                                  if (v < 0.60) return '#22c55e';
                                  if (v < 0.75) return '#d97706';
                                  if (v < 0.90) return '#ea580c';
                                  return '#dc2626';
                                };
                                return (
                                  <div key={day} style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                    <span style={{ width: '18px', fontSize: '6px', color: 'rgba(255,255,255,0.3)', textAlign: 'left' }}>{day}</span>
                                    <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '1.5px' }}>
                                      {heatRow.map((v, hIdx) => (
                                        <div key={hIdx} style={{ height: '8px', borderRadius: '1px', background: getColor(v) }} />
                                      ))}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                            {/* X-axis + legend */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: '21px', marginTop: '3px' }}>
                              {['12AM', '04AM', '08AM', '12PM', '04PM', '08PM'].map(t => (
                                <span key={t} style={{ fontSize: '5px', color: 'rgba(255,255,255,0.2)' }}>{t}</span>
                              ))}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', marginTop: '3px' }}>
                              <span style={{ fontSize: '5.5px', color: 'rgba(255,255,255,0.25)' }}>Low</span>
                              <div style={{ width: '60px', height: '3px', borderRadius: '2px', background: 'linear-gradient(to right, #101626, #1e3a8a, #2563eb, #22c55e, #d97706, #ea580c, #dc2626)' }} />
                              <span style={{ fontSize: '5.5px', color: 'rgba(255,255,255,0.25)' }}>High</span>
                            </div>
                          </div>

                          {/* Dwell Time Distribution */}
                          <div style={{ background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '10px', height: '140px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                              <span style={{ fontSize: '8px', fontWeight: 700, color: 'rgba(255,255,255,0.7)' }}>Dwell Time Distribution</span>
                              <span style={{ fontSize: '7px', color: 'rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.02)', padding: '2px 6px', borderRadius: '3px', border: '1px solid rgba(255,255,255,0.05)' }}>Today ▾</span>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '70px 1fr', alignItems: 'center', gap: '10px' }}>
                              {/* Donut SVG */}
                              <div style={{ position: 'relative', width: '70px', height: '70px' }}>
                                <svg viewBox="0 0 36 36" width="70" height="70">
                                  <circle cx="18" cy="18" r="14" fill="none" stroke="#3b82f6" strokeWidth="3" strokeDasharray="22.1 77.9" strokeDashoffset="0" />
                                  <circle cx="18" cy="18" r="14" fill="none" stroke="#6366f1" strokeWidth="3" strokeDasharray="31.4 68.6" strokeDashoffset="-22.1" />
                                  <circle cx="18" cy="18" r="14" fill="none" stroke="#f59e0b" strokeWidth="3" strokeDasharray="28.7 71.3" strokeDashoffset="-53.5" />
                                  <circle cx="18" cy="18" r="14" fill="none" stroke="#22c55e" strokeWidth="3" strokeDasharray="17.8 82.2" strokeDashoffset="-82.2" />
                                </svg>
                                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                                  <span style={{ fontSize: '12px', fontWeight: 800, color: 'white', lineHeight: 1 }}>38</span>
                                  <span style={{ fontSize: '5px', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.15em' }}>sec</span>
                                  <span style={{ fontSize: '4.5px', color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Average</span>
                                </div>
                              </div>
                              {/* Legend */}
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                {[
                                  { color: '#3b82f6', label: '0–15 sec', pct: '22.1%' },
                                  { color: '#6366f1', label: '15–30 sec', pct: '31.4%' },
                                  { color: '#f59e0b', label: '30–60 sec', pct: '28.7%' },
                                  { color: '#22c55e', label: '60+ sec', pct: '17.8%' }
                                ].map((item, i) => (
                                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '7.5px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'rgba(255,255,255,0.4)' }}>
                                      <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: item.color, flexShrink: 0 }} />
                                      <span>{item.label}</span>
                                    </div>
                                    <span style={{ fontWeight: 700, color: 'rgba(255,255,255,0.8)', fontFamily: 'monospace' }}>{item.pct}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>

                        </div>

                        {/* Footer bar */}
                        <div style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          padding: '5px 12px', borderTop: '1px solid rgba(255,255,255,0.04)',
                          fontSize: '7px', color: 'rgba(255,255,255,0.2)'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#22c55e', fontWeight: 600 }}>
                            <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 4px rgba(34,197,94,0.5)' }} />
                            All systems operational
                          </div>
                          <span>Location Intelligence Platform <span style={{ margin: '0 6px', color: 'rgba(255,255,255,0.06)' }}>|</span> Real-time human & mobility insights</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'rgba(59,130,246,0.7)', fontWeight: 600 }}>
                            <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#3b82f6', boxShadow: '0 0 4px rgba(59,130,246,0.5)', animation: 'pulse 2s ease-in-out infinite' }} />
                            Data updates every 5 seconds
                          </div>
                        </div>

                      </div>
                    </div>

                    {/* Floating data particles */}
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 0 }}>
                      {Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} style={{
                          position: 'absolute',
                          width: `${2 + Math.random() * 3}px`,
                          height: `${2 + Math.random() * 3}px`,
                          borderRadius: '50%',
                          background: i % 2 === 0 ? 'rgba(59,130,246,0.4)' : 'rgba(99,102,241,0.3)',
                          left: `${10 + Math.random() * 80}%`,
                          top: `${10 + Math.random() * 80}%`,
                          animation: `float ${4 + Math.random() * 6}s ease-in-out infinite`,
                          animationDelay: `${Math.random() * 5}s`
                        }} />
                      ))}
                    </div>

                  </div>

                  {/* CTA Button */}
                  <div style={{ textAlign: 'center', marginTop: '40px' }}>
                    <a
                      href="/media-owner"
                      onClick={(e) => navigateTo(e, '/media-owner')}
                      className="btn btn-primary btn-lg"
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: '10px',
                        padding: '14px 36px', fontSize: '15px', fontWeight: 700,
                        borderRadius: '12px',
                        background: 'linear-gradient(135deg, #2563eb, #3b82f6, #6366f1)',
                        border: '1px solid rgba(96,165,250,0.3)',
                        boxShadow: '0 0 30px rgba(59,130,246,0.3), 0 4px 20px rgba(0,0,0,0.4)',
                        color: 'white',
                        transition: 'all 0.3s ease',
                        textDecoration: 'none'
                      }}
                    >
                      <i className="fa-solid fa-rocket" style={{ fontSize: '14px' }} />
                      Explore Media Owner Platform
                      <i className="fa-solid fa-arrow-right" style={{ fontSize: '12px', opacity: 0.7 }} />
                    </a>
                  </div>

                </div>
              </section>

              {/* Scroll Timeline Component (Roadmap) */}
              <section id="roadmap" className="roadmap-section">
                <div className="section-container">
                  <div className="section-header">
                    <span className="section-tag">Evolution</span>
                    <h2 className="section-title">Building the Future of Outdoor Intelligence</h2>
                    <p className="section-desc">Our roadmap to becoming the world’s independent intelligence platform for outdoor media.</p>
                  </div>
                  <RoadmapTimeline />
                </div>
              </section>

              {/* Services Section */}
              <section id="services" className="services-section scroll-mt-20">

                <div className="section-container" style={{ position: 'relative', zIndex: 10 }}>
                  <div className="section-header text-center" style={{ position: 'relative', zIndex: 10 }}>
                    <span className="section-tag">SERVICES</span>
                    <h2 className="section-title">Simple Pricing. Powerful Intelligence.</h2>
                    <p className="section-desc">Choose the plan that fits your media and transform every billboard into a measurable advertising asset.</p>
                  </div>

                  {/* Tab Contents */}
                  <div className="services-tab-content-active">
                    <div className="services-grid cols-2">
                      {/* Media Owners Card 1 */}
                      <div className="services-card">
                        <div className="services-card-top">
                          <h3 className="services-plan-name">Static Billboard Intelligence</h3>
                          <p className="services-plan-desc">Everything you need to measure, understand, and increase the value of your static billboard.</p>
                          <ul className="services-plan-features">
                            <li><i className="fa-solid fa-check"></i> Live Traffic Intelligence</li>
                            <li><i className="fa-solid fa-check"></i> Audience & Vehicle Insights</li>
                            <li><i className="fa-solid fa-check"></i> Location Intelligence</li>
                            <li><i className="fa-solid fa-check"></i> Peak Hour & Trend Analysis</li>
                            <li><i className="fa-solid fa-check"></i> Historical Performance Data</li>
                            <li><i className="fa-solid fa-check"></i> Monthly Performance Reports</li>
                            <li><i className="fa-solid fa-check"></i> AI-Powered Recommendations</li>
                            <li><i className="fa-solid fa-check"></i> Featured Media Listing</li>
                            <li><i className="fa-solid fa-check"></i> Direct Advertiser Enquiries</li>
                            <li><i className="fa-solid fa-check"></i> Cloud Dashboard Access</li>
                          </ul>
                        </div>
                        <div className="services-card-bottom">
                          <div className="services-best-for">
                            <strong>Best For</strong>
                            Media owners looking to prove billboard performance, attract more advertisers, and increase media value.
                          </div>
                          <button
                            className="btn btn-outline w-full"
                            onClick={() => handleContactNavigation('Contact Sales')}
                          >
                            Get Started
                          </button>
                        </div>
                      </div>

                      {/* Media Owners Card 2 */}
                      <div className="services-card premium">
                        <div className="services-premium-badge">MOST POPULAR</div>
                        <div className="services-card-top">
                          <h3 className="services-plan-name">DOOH Intelligence</h3>
                          <p className="services-plan-desc">Everything in the Static Intelligence plan, plus advanced tools to manage, monetize, and automate your digital screens.</p>
                          <ul className="services-plan-features">
                            <li className="feature-header-extra">Includes everything in Static plan, plus:</li>
                            <li><i className="fa-solid fa-check"></i> Digital Screen Health Monitoring</li>
                            <li><i className="fa-solid fa-check"></i> Campaign Scheduling</li>
                            <li><i className="fa-solid fa-check"></i> Remote Content Management</li>
                            <li><i className="fa-solid fa-check"></i> Live Campaign Reporting</li>
                            <li><i className="fa-solid fa-check"></i> Proof-of-Play Verification</li>
                            <li><i className="fa-solid fa-check"></i> Advertiser Self-Service Booking</li>
                            <li><i className="fa-solid fa-check"></i> Campaign Management Dashboard</li>
                            <li><i className="fa-solid fa-check"></i> Programmatic-Ready Infrastructure</li>
                            <li><i className="fa-solid fa-check"></i> AI-Powered Campaign Optimization</li>
                            <li><i className="fa-solid fa-check"></i> Direct Revenue Opportunities from Advertisers</li>
                          </ul>
                        </div>
                        <div className="services-card-bottom">
                          <div className="services-best-for">
                            <strong>Best For</strong>
                            Digital media owners looking to maximize occupancy, automate operations, and unlock new revenue opportunities.
                          </div>
                          <button
                            className="btn btn-primary w-full"
                            onClick={() => handleContactNavigation('Contact Sales')}
                          >
                            Get Started
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Included with Every Plan */}
                  <div className="included-features-section">
                    <div className="section-header text-center">
                      <h3 className="section-title" style={{ fontSize: '28px' }}>Included with Every Plan</h3>
                    </div>
                    <div className="included-features-grid">
                      <div className="included-feature-card">
                        <div className="included-feature-icon"><i className="fa-solid fa-shield-halved"></i></div>
                        <span className="included-feature-text">Secure Cloud Platform</span>
                      </div>
                      <div className="included-feature-card">
                        <div className="included-feature-icon"><i className="fa-solid fa-chart-line"></i></div>
                        <span className="included-feature-text">Real-Time Dashboard</span>
                      </div>
                      <div className="included-feature-card">
                        <div className="included-feature-icon"><i className="fa-solid fa-rotate"></i></div>
                        <span className="included-feature-text">Automatic Software Updates</span>
                      </div>
                      <div className="included-feature-card">
                        <div className="included-feature-icon"><i className="fa-solid fa-brain"></i></div>
                        <span className="included-feature-text">AI-Powered Insights</span>
                      </div>
                      <div className="included-feature-card">
                        <div className="included-feature-icon"><i className="fa-solid fa-map-location-dot"></i></div>
                        <span className="included-feature-text">Traffic, Audience & Location Intelligence</span>
                      </div>
                      <div className="included-feature-card">
                        <div className="included-feature-icon"><i className="fa-solid fa-chart-simple"></i></div>
                        <span className="included-feature-text">Real-Time Campaign Analytics</span>
                      </div>
                      <div className="included-feature-card">
                        <div className="included-feature-icon"><i className="fa-solid fa-headset"></i></div>
                        <span className="included-feature-text">Dedicated Customer Support</span>
                      </div>
                    </div>
                  </div>

                  {/* Final CTA Section */}
                  <div className="services-cta-section">
                    <div className="services-cta-card">
                      <h3 className="services-cta-title">Measure. Optimize. Grow.</h3>
                      <p className="services-cta-desc">Transform outdoor advertising into measurable business intelligence with an AE platform.</p>
                      <div className="services-cta-actions">
                        <button
                          className="btn btn-primary btn-lg"
                          onClick={() => handleContactNavigation('Book a Demo')}
                        >
                          Book a Demo
                        </button>
                      </div>
                    </div>
                  </div>

                </div>
              </section>

              {/* ── About Us ── */}
              <section id="about" className="about-section">
                <div className="section-container">

                  {/* 1. THE HERO HOOK & TAGLINE */}
                  <div className="section-header about-header" style={{ margin: '0 auto 60px auto', textAlign: 'center', maxWidth: '800px' }}>
                    <span className="section-tag" style={{ margin: '0 auto 16px auto' }}>About Us</span>
                    <h2 className="section-title" style={{ fontSize: '44px', lineHeight: '1.2' }}>
                      We Don't Measure Billboards.<br />
                      We Decode <span className="text-gradient">Attention.</span>
                    </h2>
                    <p className="section-desc" style={{ fontSize: '18px', margin: '16px auto 0 auto', maxWidth: '650px' }}>
                      Transforming Every Physical Advertisement into an Intelligent Digital Experience.
                    </p>
                  </div>

                  {/* 2. TWO CONTENT CARDS (COMPARISON) */}
                  <div className="about-duality-grid">

                    {/* The Old Way */}
                    <div className="about-duality-card about-problem-card">
                      <div className="about-duality-badge problem-badge">
                        <i className="fa-solid fa-triangle-exclamation"></i> The Old Way
                      </div>
                      <h3>Outdoor Advertising Has Been Flying Blind</h3>
                      <ul className="about-callout-list">
                        <li>
                          <i className="fa-solid fa-xmark"></i>
                          <span><strong>Traffic "estimates"</strong> based on decade-old census data</span>
                        </li>
                        <li>
                          <i className="fa-solid fa-xmark"></i>
                          <span><strong>Zero attention metrics</strong> — did anyone even look?</span>
                        </li>
                        <li>
                          <i className="fa-solid fa-xmark"></i>
                          <span><strong>Quarterly reports</strong> that arrive after campaigns are already dead</span>
                        </li>
                        <li>
                          <i className="fa-solid fa-xmark"></i>
                          <span><strong>Millions spent</strong> on gut instinct and hope</span>
                        </li>
                      </ul>
                      <p className="about-callout-punchline">
                        "Spend big, pray hard, measure never." That era is <strong>over</strong>.
                      </p>
                    </div>

                    {/* The Solution (The Aculion Way) */}
                    <div className="about-duality-card about-solution-card">
                      <div className="about-duality-badge solution-badge">
                        <i className="fa-solid fa-rocket"></i> The Aculion Way
                      </div>
                      <h3>Making the Unmeasurable, Unmistakable</h3>
                      <ul className="about-callout-list solution-list">
                        <li>
                          <i className="fa-solid fa-check"></i>
                          <span><strong>Edge-deployed computer vision</strong> — AI that lives on the billboard itself</span>
                        </li>
                        <li>
                          <i className="fa-solid fa-check"></i>
                          <span><strong>Real-time pedestrian & vehicle counting</strong> — not estimates, reality</span>
                        </li>
                        <li>
                          <i className="fa-solid fa-check"></i>
                          <span><strong>Gaze & dwell-time analytics</strong> — who looked, how long, what happened next</span>
                        </li>
                        <li>
                          <i className="fa-solid fa-check"></i>
                          <span><strong>Privacy-first architecture</strong> — GDPR compliant, faces blurred, data encrypted</span>
                        </li>
                      </ul>
                      <p className="about-callout-punchline solution-punchline">
                        Beyond billboards. Into <span className="text-gradient">intelligence.</span>
                      </p>
                    </div>
                  </div>

                </div>
              </section>

            </>
          )}

          {/* Contact Section - rendered only on landing/home views */}
          {route !== '/sign-in' && route !== '/forgot-password' && <ContactSection />}

          {/* Footer */}
          <footer id="footer" className="main-footer">
            <div className="section-container footer-container">
              {/* Column 1: Brand */}
              <div className="footer-brand-column">
                <a href="/" onClick={(e) => handleNavLinkClick(e, '/', 'hero')} className="logo">
                  <img src={newLogo} alt="Aculion Logo" className="logo-img footer-logo-img" />
                </a>
                <p className="footer-desc">Building the intelligence infrastructure for the next generation of Out-of-Home advertising.</p>
                <div className="footer-social-links">
                  <a href="mailto:connect@aculion.com" aria-label="Email Us" className="footer-social-icon"><i className="fa-solid fa-envelope"></i></a>
                  <a href="tel:+919176590590" aria-label="Call Us" className="footer-social-icon"><i className="fa-solid fa-phone"></i></a>
                  <a href="#contact-section" onClick={(e) => handleNavLinkClick(e, route, 'contact-section')} aria-label="Contact Section" className="footer-social-icon"><i className="fa-solid fa-headset"></i></a>
                </div>
              </div>

              {/* Column 2: Product */}
              <div className="footer-links-col">
                <h4 className="footer-col-title">PRODUCT</h4>
                <a href="#features" onClick={(e) => handleNavLinkClick(e, '/', 'features')}>Features</a>
                <a href="#solutions" onClick={(e) => handleNavLinkClick(e, '/', 'solutions')}>Insights</a>
                <a href="#services" onClick={(e) => handleNavLinkClick(e, '/', 'services')}>Services</a>
                <a href="/dashboard" onClick={(e) => navigateTo(e, '/dashboard')}>Dashboard</a>
                <a href="#roadmap" onClick={(e) => handleNavLinkClick(e, '/', 'roadmap')}>Roadmap</a>
              </div>

              {/* Column 3: Company */}
              <div className="footer-links-col">
                <h4 className="footer-col-title">COMPANY</h4>
                <a href="#about" onClick={(e) => handleNavLinkClick(e, '/', 'about')}>About Us</a>
                <a href="#contact-section" onClick={(e) => handleNavLinkClick(e, route, 'contact-section')}>Contact</a>
                <a href="#">Privacy Policy</a>
                <a href="#">Terms of Service</a>
              </div>

              {/* Column 4: Services */}
              <div className="footer-links-col">
                <h4 className="footer-col-title">SERVICES</h4>
                <a href="#services" onClick={(e) => handleNavLinkClick(e, '/', 'services')}>Static Billboard Intelligence</a>
                <a href="#services" onClick={(e) => handleNavLinkClick(e, '/', 'services')}>DOOH Intelligence</a>
                <a href="/media-owner" onClick={(e) => navigateTo(e, '/media-owner')}>Media Owner Platform</a>
                <a href="#solutions" onClick={(e) => handleNavLinkClick(e, '/', 'solutions')}>Advertiser Solutions</a>
              </div>

              {/* Column 5: Contact */}
              <div className="footer-links-col footer-contact-col">
                <h4 className="footer-col-title">CONTACT</h4>
                <div className="footer-contact-item">
                  <i className="fa-solid fa-envelope footer-contact-icon"></i>
                  <a href="mailto:connect@aculion.com" className="footer-contact-link">connect@aculion.com</a>
                </div>
                <div className="footer-contact-item">
                  <i className="fa-solid fa-phone footer-contact-icon"></i>
                  <a href="tel:+919176590590" className="footer-contact-link">+91 91765 90590</a>
                </div>
                <div className="footer-contact-item">
                  <i className="fa-solid fa-clock footer-contact-icon"></i>
                  <span className="footer-contact-text">Mon–Fri, 9 AM – 6 PM IST</span>
                </div>
              </div>
            </div>

            {/* Bottom Footer */}
            <div className="footer-bottom">
              <div className="section-container footer-bottom-container">
                <p className="footer-copyright">&copy; 2026 Aculion Inc. All rights reserved.</p>
                <div className="footer-bottom-center">
                  <span className="footer-tagline-pill">AI-Powered Out-of-Home Intelligence</span>
                </div>
                <div className="footer-legal-links">
                  <a href="#">Privacy Policy</a>
                  <span className="footer-link-divider">•</span>
                  <a href="#">Terms of Service</a>
                  <span className="footer-link-divider">•</span>
                  <a href="#contact-section" onClick={(e) => handleNavLinkClick(e, route, 'contact-section')}>Contact</a>
                </div>
              </div>
            </div>
          </footer>
        </main>
      )}

      {/* Book a Demo Popup Modal */}
      <BookDemoModal isOpen={isDemoModalOpen} onClose={() => setIsDemoModalOpen(false)} />
    </div>
  );
}


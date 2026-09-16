import React, { useState, useEffect } from 'react';
import newLogo from '../assets/aculion_logo_transparent.png';
import { billboardService } from '../services/billboard.service';
import { supabase } from '../services/supabase';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

export default function MediaProfilePage({
  user,
  billboards,
  onSelectBillboard,
  onAddBillboard,
  onLogout,
  navigateTo
}) {
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAddBrandModal, setShowAddBrandModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [filterType, setFilterType] = useState('Billboard'); // ONLY 'Billboard' | 'Brand' (NO 'All')

  // Brands list state - loaded dynamically from database
  const [brands, setBrands] = useState([]);

  // Form states for Add Billboard Modal
  const [formData, setFormData] = useState({
    name: '',
    id: `ACU-BB-${Math.floor(1000 + Math.random() * 9000)}`,
    cameraCodeFF: '',
    cameraCodeBF: '',
    location: '',
    address: '',
    city: 'Chennai',
    state: 'Tamil Nadu',
    country: 'India',
    latitude: '13.0827',
    longitude: '80.2707',
    width: '40 ft',
    height: '20 ft',
    type: 'Digital Billboard',
    screenType: 'High-Brightness Outdoor LED',
    status: 'Active',
    image: '/blog_smart_city.png',
    ownerUserType: 'existing', // 'existing' | 'new'
    ownerName: '',
    ownerEmail: '',
    ownerPassword: '',
    ownerCompany: ''
  });

  // Form states for Add Brand Modal
  const [brandFormData, setBrandFormData] = useState({
    name: '',
    company: '',
    username: '',
    email: '',
    password: '',
    phone: '',
    category: 'Retail & FMCG',
    billboards: 'Chennai Network',
    status: 'Active',
    image: '/blog_attention_metrics.png'
  });

  const [formError, setFormError] = useState('');
  const [brandFormError, setBrandFormError] = useState('');
  const [registeredOwners, setRegisteredOwners] = useState([]);

  const isAdmin = user?.role === 'Administrator';

  // Contact Aculion Team Modal state (for billboard owners and brand owners)
  const [showContactModal, setShowContactModal] = useState(false);
  const [contactSubmitting, setContactSubmitting] = useState(false);
  const [contactSubmitted, setContactSubmitted] = useState(false);
  const [contactFormData, setContactFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    location: '',
    billboardType: 'Digital Billboard',
    dimensions: '40 ft × 20 ft',
    notes: ''
  });

  const handleContactSubmit = (e) => {
    e.preventDefault();
    setContactSubmitting(true);
    setTimeout(() => {
      setContactSubmitting(false);
      setContactSubmitted(true);
      showToast('contact', 'Aculion Onboarding Team');
    }, 500);
  };

  // Toast notification state
  const [toast, setToast] = useState(null); // { type: 'billboard'|'brand'|'contact', name: string }
  const toastTimerRef = React.useRef(null);

  const showToast = (type, name) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ type, name });
    toastTimerRef.current = setTimeout(() => setToast(null), 4000);
  };

  // Fetch owners and brands dynamically from database
  const fetchDbData = async () => {
    try {
      // Fetch owners
      const { data: owners, error: ownersErr } = await supabase
        .from('billboard_owners')
        .select('id, owner_name, email, company_name');
      if (ownersErr) throw ownersErr;
      setRegisteredOwners(owners || []);

      // Fetch brands if Administrator
      if (user?.role === 'Administrator') {
        const { data: bPartners, error: brandErr } = await supabase
          .from('brand_partners')
          .select('*')
          .order('created_at', { ascending: false });
        if (brandErr) throw brandErr;
        
        const mapped = (bPartners || []).map(b => ({
          id: b.id,
          brand_code: `ACU-BR-${b.id.substring(0, 4).toUpperCase()}`,
          name: b.campaign_title,
          company: b.company_name,
          username: b.brand_user_name,
          email: b.contact_email,
          phone: b.phone_number,
          category: b.industry_category,
          billboards: b.target_coverage_range,
          status: 'Active'
        }));
        setBrands(mapped);
      }
    } catch (err) {
      console.error('[MediaProfilePage] Error loading DB users/brands:', err);
    }
  };

  useEffect(() => {
    fetchDbData();
  }, [user]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleBrandInputChange = (e) => {
    const { name, value } = e.target;
    setBrandFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!formData.name.trim() || !formData.location.trim() || !formData.address.trim()) {
      setFormError('Please fill in all required fields (Name, Location Landmark, and Street Address).');
      return;
    }

    if (!formData.cameraCodeFF.trim() && !formData.cameraCodeBF.trim()) {
      setFormError('Please provide at least one camera code (Camera FF or Camera BF).');
      return;
    }

    if (formData.ownerUserType === 'new') {
      if (!formData.ownerName.trim() || !formData.ownerEmail.trim() || !formData.ownerPassword.trim()) {
        setFormError('Please fill in New Owner Name, Owner Email ID, and Password.');
        return;
      }
    } else {
      if (!formData.ownerEmail.trim()) {
        setFormError('Please select an existing owner from the list.');
        return;
      }
    }

    try {
      const lat = parseFloat(formData.latitude) || 13.0827;
      const lng = parseFloat(formData.longitude) || 80.2707;
      
      let targetOwnerId = null;

      // 1. Handle user registration if new owner
      if (formData.ownerUserType === 'new') {
        const session = (await supabase.auth.getSession()).data.session;
        const token = session?.access_token;

        const response = await fetch(`${API_BASE_URL}/api/location/v1/admin/create-user`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            email: formData.ownerEmail.trim().toLowerCase(),
            password: formData.ownerPassword,
            owner_name: formData.ownerName.trim(),
            company_name: formData.ownerCompany.trim() || 'Aculion Owner Partner',
            role: 'Media Owner (Billboard Operator)'
          })
        });

        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.detail || 'Failed to register new owner user.');
        }
        targetOwnerId = result.user.id;
      } else {
        // Resolve targetOwnerId from existing owners list
        const match = registeredOwners.find(o => o.email.trim().toLowerCase() === formData.ownerEmail.trim().toLowerCase());
        if (!match) {
          throw new Error('Selected owner email is not registered in the database.');
        }
        targetOwnerId = match.id;
      }

      // 2. Insert billboard into database
      const newAsset = await billboardService.createBillboard({
        name: formData.name,
        id: formData.id,
        location: formData.location || formData.address,
        address: formData.address,
        city: formData.city,
        type: formData.type,
        status: formData.status,
        latitude: lat,
        longitude: lng,
        cameraCodeFF: formData.cameraCodeFF,
        cameraCodeBF: formData.cameraCodeBF,
        ownerId: targetOwnerId
      });

      newAsset.ownerName = formData.ownerName;
      newAsset.ownerEmail = formData.ownerEmail;
      newAsset.cameraCodeFF = formData.cameraCodeFF;
      newAsset.cameraCodeBF = formData.cameraCodeBF;

      onAddBillboard(newAsset);
      showToast('billboard', formData.name || 'Billboard');
      setShowAddModal(false);
      
      setFormData({
        name: '',
        id: `ACU-BB-${Math.floor(1000 + Math.random() * 9000)}`,
        cameraCodeFF: '',
        cameraCodeBF: '',
        location: '',
        address: '',
        city: 'Chennai',
        state: 'Tamil Nadu',
        country: 'India',
        latitude: '13.0827',
        longitude: '80.2707',
        width: '40 ft',
        height: '20 ft',
        type: 'Digital Billboard',
        screenType: 'High-Brightness Outdoor LED',
        status: 'Active',
        image: '/blog_smart_city.png',
        ownerUserType: 'existing',
        ownerName: '',
        ownerEmail: '',
        ownerPassword: '',
        ownerCompany: ''
      });

      // Refresh registered owners list
      const { data: updatedOwners } = await supabase
        .from('billboard_owners')
        .select('id, owner_name, email, company_name');
      if (updatedOwners) {
        setRegisteredOwners(updatedOwners);
      }
    } catch (err) {
      console.error('[handleAddSubmit] createBillboard error:', err);
      setFormError(err.message || 'Failed to save billboard.');
    }
  };

  const handleBrandSubmit = async (e) => {
    e.preventDefault();
    setBrandFormError('');
    if (!brandFormData.name.trim() || !brandFormData.company.trim() || !brandFormData.email.trim() || !brandFormData.username.trim() || !brandFormData.password.trim()) {
      setBrandFormError('Please fill in Brand Title, Company Name, User Name, Contact Email, and Account Password.');
      return;
    }

    try {
      const session = (await supabase.auth.getSession()).data.session;
      const token = session?.access_token;

      // 1. Create brand advertiser user on the backend
      const response = await fetch(`${API_BASE_URL}/api/location/v1/admin/create-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          email: brandFormData.email.trim().toLowerCase(),
          password: brandFormData.password,
          owner_name: brandFormData.username || brandFormData.name,
          company_name: brandFormData.company.trim(),
          role: 'Brand Advertiser',
          brand_user_name: brandFormData.username.trim(),
          campaign_title: brandFormData.name.trim(),
          industry_category: brandFormData.category,
          phone_number: brandFormData.phone || '+91 98765 00000',
          target_coverage_range: brandFormData.billboards || 'Chennai Network'
        })
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.detail || 'Failed to create brand advertiser account.');
      }

      // 2. Map response to brand item
      const newBrand = {
        id: result.user.id,
        brand_code: `ACU-BR-${result.user.id.substring(0, 4).toUpperCase()}`,
        name: brandFormData.name.trim(),
        company: brandFormData.company.trim(),
        username: brandFormData.username.trim(),
        email: brandFormData.email.trim().toLowerCase(),
        phone: brandFormData.phone || '+91 98765 00000',
        category: brandFormData.category,
        billboards: brandFormData.billboards || 'Chennai Network',
        status: 'Active',
        image: '/blog_attention_metrics.png'
      };

      setBrands(prev => [newBrand, ...prev]);
      showToast('brand', brandFormData.name || 'Brand');
      setShowAddBrandModal(false);
      
      setBrandFormData({
        name: '',
        company: '',
        username: '',
        email: '',
        password: '',
        phone: '',
        category: 'Retail & FMCG',
        billboards: 'Chennai Network',
        status: 'Active',
        image: '/blog_attention_metrics.png'
      });
    } catch (err) {
      console.error('Error creating brand:', err);
      setBrandFormError(err.message || 'An error occurred during Brand creation.');
    }
  };

  // Place / Location functional search filter
  const currentQuery = (activeSearch || searchQuery).toLowerCase().trim();

  const filteredBillboards = billboards.filter(b => {
    if (!currentQuery) return true;
    const loc = (b.location || '').toLowerCase();
    const addr = (b.address || '').toLowerCase();
    const city = (b.city || '').toLowerCase();
    const name = (b.name || '').toLowerCase();
    const id = (b.id || '').toLowerCase();
    return loc.includes(currentQuery) || addr.includes(currentQuery) || city.includes(currentQuery) || name.includes(currentQuery) || id.includes(currentQuery);
  });

  const filteredBrands = brands.filter(br => {
    if (!currentQuery) return true;
    const loc = (br.billboards || '').toLowerCase();
    const name = (br.name || '').toLowerCase();
    const comp = (br.company || '').toLowerCase();
    const id = (br.id || '').toLowerCase();
    return loc.includes(currentQuery) || name.includes(currentQuery) || comp.includes(currentQuery) || id.includes(currentQuery);
  });

  const handleSearchSubmit = (e) => {
    e?.preventDefault();
    setActiveSearch(searchQuery);
  };

  return (
    <div className="min-h-screen bg-[#050816] text-white flex flex-col font-sans select-none relative overflow-x-hidden">
      
      {/* Background ambient glow orbs - Aculion Blue & Cyan Palette */}
      <div className="fixed top-[-100px] left-1/4 w-[500px] h-[500px] bg-[#0052ff]/15 rounded-full blur-[140px] pointer-events-none" />
      <div className="fixed bottom-[-100px] right-1/4 w-[500px] h-[500px] bg-[#00f0ff]/10 rounded-full blur-[140px] pointer-events-none" />

      {/* ── SUCCESS TOAST NOTIFICATION ── */}
      <div
        style={{
          position: 'fixed',
          top: '24px',
          right: toast ? '24px' : '-420px',
          zIndex: 9999,
          transition: 'right 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)',
          minWidth: '320px',
          maxWidth: '400px'
        }}
      >
        {toast && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            padding: '14px 18px',
            borderRadius: '14px',
            background: 'linear-gradient(135deg, rgba(10,20,40,0.97) 0%, rgba(10,30,50,0.97) 100%)',
            border: '1px solid rgba(0, 240, 80, 0.35)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 0 24px rgba(0,240,80,0.12)',
            backdropFilter: 'blur(16px)'
          }}>
            {/* Icon bubble */}
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'rgba(0, 240, 80, 0.12)',
              border: '1px solid rgba(0, 240, 80, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <i
                className={
                  toast.type === 'brand' ? 'fa-solid fa-briefcase' :
                  toast.type === 'contact' ? 'fa-solid fa-headset' :
                  'fa-solid fa-tower-cell'
                }
                style={{ color: '#00f050', fontSize: '16px' }}
              />
            </div>

            {/* Text */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                <i className="fa-solid fa-circle-check" style={{ color: '#00f050', fontSize: '12px' }} />
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#00f050', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  {toast.type === 'brand' ? 'Brand Saved' : toast.type === 'contact' ? 'Request Sent' : 'Billboard Saved'}
                </span>
              </div>
              {toast.type === 'contact' ? (
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  Onboarding request sent to Aculion Team.
                </div>
              ) : (
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  <span style={{ color: 'rgba(255,255,255,0.55)', fontWeight: 400 }}>"</span>
                  {toast.name}
                  <span style={{ color: 'rgba(255,255,255,0.55)', fontWeight: 400 }}>"</span>
                  {' '}details saved successfully.
                </div>
              )}
            </div>

            {/* Progress bar */}
            <div style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: '3px',
              borderRadius: '0 0 14px 14px',
              background: 'rgba(0,240,80,0.15)',
              overflow: 'hidden'
            }}>
              <div style={{
                height: '100%',
                background: 'linear-gradient(90deg, #00c853, #00f050)',
                animation: 'toastProgress 4s linear forwards'
              }} />
            </div>

            {/* Close button */}
            <button
              onClick={() => { if (toastTimerRef.current) clearTimeout(toastTimerRef.current); setToast(null); }}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'rgba(255,255,255,0.35)',
                fontSize: '13px',
                padding: '4px',
                flexShrink: 0,
                lineHeight: 1
              }}
              title="Dismiss"
            >
              <i className="fa-solid fa-xmark" />
            </button>
          </div>
        )}
      </div>

      {/* Keyframe for toast progress bar */}
      <style>{`
        @keyframes toastProgress {
          from { width: 100%; }
          to   { width: 0%; }
        }
      `}</style>

      {/* ── TOP HEADER ── */}
      <header className="h-[72px] border-b border-white/10 px-6 lg:px-12 flex items-center justify-between bg-[#080c16]/80 backdrop-blur-md sticky top-0 z-40">
        <a href="/" onClick={(e) => navigateTo && navigateTo(e, '/')} className="flex items-center gap-3">
          <img src={newLogo} alt="Aculion Logo" className="h-[42px] w-auto object-contain" />
        </a>

        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-3 px-3.5 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/30">
            <div className="w-7 h-7 rounded-full bg-blue-500/20 border border-blue-400/40 flex items-center justify-center text-cyan-300 text-xs font-bold">
              <i className="fa-solid fa-user-shield" />
            </div>
            <div className="flex flex-col text-left">
              <span className="text-[12px] font-bold text-white leading-tight">
                {user?.name || 'Administrator'}
              </span>
              <span className="text-[10px] text-cyan-300/70 leading-tight">
                {user?.email || 'developer@aculion.com'}
              </span>
            </div>
          </div>

          <button
            onClick={onLogout}
            className="px-4 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-[13px] font-semibold transition-all flex items-center gap-2 cursor-pointer"
          >
            <i className="fa-solid fa-arrow-right-from-bracket text-[12px]" />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* ── MAIN CONTENT AREA ── */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8 flex flex-col gap-8 z-10">

        {/* ── UPPER MENTION ADMIN & ONLY ONE "+" ACTION BUTTON ── */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6">
          <div>
            <div className="flex items-center gap-2 text-cyan-400 text-xs font-semibold uppercase tracking-wider mb-1">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              {user?.role === 'Administrator' ? 'Admin Management Console' : 'Billboard Operator Console'}
            </div>
            <h1 className="text-2xl md:text-3xl font-bold font-heading tracking-tight text-white flex items-center gap-3">
              <span>{user?.role === 'Administrator' ? 'Admin Portal' : 'Media Owner Portal'}</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/20 border border-blue-500/40 text-cyan-300 font-medium">
                {user?.role === 'Administrator' ? 'Admin Role' : 'Operator Role'}
              </span>
            </h1>
            <p className="text-sm text-white/50 mt-1">
              {user?.role === 'Administrator' 
                ? 'Manage outdoor billboard networks and brand advertiser accounts across the Aculion platform.' 
                : 'Monitor active telemetry, camera exposure stats, and managed billboard listings.'}
            </p>
          </div>

          {/* ONLY ONE "+" ACTION BUTTON WITH DROPDOWN OPTIONS (ADMIN ONLY) */}
          {user?.role === 'Administrator' && (
            <div className="relative self-start md:self-auto">
              <button
                onClick={() => setShowAddMenu(!showAddMenu)}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-semibold text-xs tracking-wide shadow-lg shadow-blue-500/25 border border-cyan-400/30 transition-all flex items-center gap-2 cursor-pointer"
              >
                <i className="fa-solid fa-plus text-sm" />
                <span>Add</span>
                <i className="fa-solid fa-chevron-down text-[10px] opacity-70 ml-1" />
              </button>

              {showAddMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-[#0e1424] border border-cyan-500/30 rounded-xl shadow-2xl py-2 z-50 flex flex-col gap-1 backdrop-blur-md">
                  <button
                    onClick={() => { setShowAddMenu(false); setShowAddModal(true); }}
                    className="w-full text-left px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-600/20 hover:text-blue-400 flex items-center gap-2.5 transition-colors cursor-pointer"
                  >
                    <i className="fa-solid fa-tower-cell text-blue-400 text-sm" />
                    <span>Add Billboard</span>
                  </button>
                  <button
                    onClick={() => { setShowAddMenu(false); setShowAddBrandModal(true); }}
                    className="w-full text-left px-4 py-2.5 text-xs font-semibold text-white hover:bg-cyan-600/20 hover:text-cyan-400 flex items-center gap-2.5 transition-colors cursor-pointer"
                  >
                    <i className="fa-solid fa-briefcase text-cyan-400 text-sm" />
                    <span>Add Brand</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── PROFILE INFORMATION BADGE PANEL ── */}
        <section className="bg-[#0e1424]/70 border border-white/10 rounded-2xl p-6 backdrop-blur-md shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-full bg-gradient-to-l from-blue-600/10 to-transparent pointer-events-none" />

          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-bold text-cyan-400 tracking-widest uppercase flex items-center gap-1.5">
              <i className="fa-solid fa-user-shield" /> {user?.role === 'Administrator' ? 'ADMIN MASTER PROFILE' : 'MEDIA OWNER PROFILE'}
            </span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-semibold flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
              {user?.role === 'Administrator' ? 'System Admin' : 'Media Owner'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-[#12192e]/80 border border-white/5 rounded-xl p-4 flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 text-base flex-shrink-0">
                <i className="fa-solid fa-building-shield" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[10px] text-white/40 uppercase tracking-wider font-semibold">
                  {user?.role === 'Administrator' ? 'Platform' : 'Media Network'}
                </span>
                <span className="text-sm font-bold text-white truncate mt-0.5 font-heading">
                  {user?.role === 'Administrator' ? 'Aculion Enterprise' : (user?.company || 'Media Owner Network')}
                </span>
              </div>
            </div>

            <div className="bg-[#12192e]/80 border border-white/5 rounded-xl p-4 flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 text-base flex-shrink-0">
                <i className="fa-solid fa-user-gear" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[10px] text-white/40 uppercase tracking-wider font-semibold">
                  {user?.role === 'Administrator' ? 'Admin Account' : 'Operator Account'}
                </span>
                <span className="text-sm font-bold text-white truncate mt-0.5 font-heading">
                  {user?.name || 'Media Owner'}
                </span>
              </div>
            </div>

            <div className="bg-[#12192e]/80 border border-white/5 rounded-xl p-4 flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 text-base flex-shrink-0">
                <i className="fa-solid fa-envelope" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[10px] text-white/40 uppercase tracking-wider font-semibold">
                  {user?.role === 'Administrator' ? 'Admin Email' : 'Operator Email'}
                </span>
                <span className="text-sm font-bold text-white truncate mt-0.5 font-mono">
                  {user?.email || 'owner@aculion.com'}
                </span>
              </div>
            </div>

            <div className="bg-[#12192e]/80 border border-white/5 rounded-xl p-4 flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 text-base flex-shrink-0">
                <i className="fa-solid fa-layer-group" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[10px] text-white/40 uppercase tracking-wider font-semibold">
                  {user?.role === 'Administrator' ? 'Total Accounts' : 'Total Owned'}
                </span>
                <span className="text-sm font-bold text-emerald-400 mt-0.5 flex items-center gap-1.5">
                  <span>{billboards.length} Billboards</span>
                  {user?.role === 'Administrator' && (
                    <span className="text-[10px] text-white/40">({brands.length} Brands)</span>
                  )}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* ── LONG SEARCH BAR FOR PLACE/LOCATION ONLY & DROPDOWN FOR BILLBOARD AND BRAND ONLY ── */}
        <div style={{
          backgroundColor: 'rgba(14, 20, 36, 0.8)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '16px',
          padding: '16px',
          backdropFilter: 'blur(12px)',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          gap: '16px',
          width: '100%'
        }}>
          {/* LOCATION INPUT FIELD */}
          <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center' }}>
            <i className="fa-solid fa-location-dot" style={{
              position: 'absolute',
              left: '16px',
              color: '#00f0ff',
              fontSize: '14px',
              pointerEvents: 'none',
              zIndex: 2
            }} />
            <input
              type="text"
              placeholder="Search location (e.g. Anna Nagar, T. Nagar, Velachery, Chennai, OMR)..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setActiveSearch(e.target.value);
              }}
              style={{
                width: '100%',
                height: '46px',
                backgroundColor: '#141d33',
                border: '1px solid rgba(0, 240, 255, 0.2)',
                borderRadius: '12px',
                paddingLeft: '44px',
                paddingRight: '16px',
                fontSize: '13px',
                color: '#ffffff',
                outline: 'none',
                boxShadow: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.2)'
              }}
            />
          </div>

          {/* SEARCH LOCATION BUTTON */}
          <button
            type="button"
            onClick={handleSearchSubmit}
            style={{
              height: '46px',
              paddingLeft: '22px',
              paddingRight: '22px',
              background: 'linear-gradient(135deg, #0052ff, #00c8ff)',
              color: '#ffffff',
              borderRadius: '12px',
              fontSize: '13px',
              fontWeight: '600',
              border: 'none',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 14px 0 rgba(0, 82, 255, 0.35)',
              flexShrink: 0
            }}
          >
            <i className="fa-solid fa-magnifying-glass" style={{ fontSize: '12px' }} />
            <span>Search Location</span>
          </button>

          {/* DROPDOWN SELECTOR (ADMIN ONLY) */}
          {user?.role === 'Administrator' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
              <span style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.6)', fontWeight: '600', whiteSpace: 'nowrap' }}>View:</span>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                style={{
                  width: '160px',
                  height: '46px',
                  backgroundColor: '#141d33',
                  border: '1px solid rgba(0, 240, 255, 0.4)',
                  borderRadius: '12px',
                  paddingLeft: '14px',
                  paddingRight: '14px',
                  fontSize: '13px',
                  color: '#ffffff',
                  fontWeight: '600',
                  cursor: 'pointer',
                  outline: 'none'
                }}
              >
                <option value="Billboard">Billboard</option>
                <option value="Brand">Brand</option>
              </select>
            </div>
          )}
        </div>

        {/* ── DISPLAY SELECTED VIEW (BILLBOARD OR BRAND) ── */}
        <section className="flex flex-col gap-8">

          {/* ── BILLBOARD VIEW ── */}
          {filterType === 'Billboard' && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <i className="fa-solid fa-tower-cell text-cyan-400 text-sm" />
                  <h2 className="text-lg font-bold font-heading text-white">Billboard Inventory Cards</h2>
                  <span className="text-xs px-2 py-0.5 rounded-md bg-blue-500/10 text-cyan-400 border border-blue-500/20 font-mono">
                    {filteredBillboards.length} Items
                  </span>
                </div>
                {isAdmin ? (
                  <button
                    onClick={() => setShowAddModal(true)}
                    className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <i className="fa-solid fa-plus text-[10px]" />
                    <span>Add Billboard</span>
                  </button>
                ) : (
                  <button
                    onClick={() => { setShowContactModal(true); setContactSubmitted(false); }}
                    className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1.5 cursor-pointer bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 px-3 py-1.5 rounded-xl transition-all"
                  >
                    <i className="fa-solid fa-headset text-xs" />
                    <span>Contact Aculion to Add Billboard</span>
                  </button>
                )}
              </div>

              {/* Billboard Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredBillboards.map((billboard) => (
                  <div
                    key={billboard.id}
                    onClick={() => onSelectBillboard(billboard)}
                    className="group bg-[#0e1424]/80 hover:bg-[#131b30] border border-white/10 hover:border-blue-500/40 rounded-2xl overflow-hidden transition-all duration-300 shadow-xl hover:shadow-2xl hover:shadow-blue-500/10 cursor-pointer flex flex-col relative"
                  >
                    <div className="h-40 w-full bg-[#050811] relative overflow-hidden flex-shrink-0">
                      <img
                        src={billboard.image || '/anna_nagar_location.png'}
                        alt={billboard.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-80 group-hover:opacity-100"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = '/anna_nagar_location.png';
                        }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#0e1424] via-transparent to-black/40" />

                      <span className="absolute top-3 left-3 px-2.5 py-1 rounded-md text-[10px] font-bold font-mono bg-black/60 backdrop-blur-md text-cyan-400 border border-blue-500/30">
                        {billboard.billboard_code || billboard.id}
                      </span>

                      <span className={`absolute top-3 right-3 px-2.5 py-1 rounded-md text-[10px] font-bold backdrop-blur-md flex items-center gap-1.5 border ${
                        billboard.status === 'Active'
                          ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                          : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          billboard.status === 'Active' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                        }`} />
                        {billboard.status}
                      </span>
                    </div>

                    <div className="p-5 flex flex-col flex-1 justify-between gap-4">
                      <div className="flex flex-col gap-2">
                        <h3 className="text-base font-bold text-white group-hover:text-cyan-400 transition-colors font-heading leading-snug">
                          {billboard.name}
                        </h3>
                        <p className="text-xs text-white/50 flex items-start gap-1.5 leading-normal">
                          <i className="fa-solid fa-location-dot text-cyan-400 text-xs mt-0.5 flex-shrink-0" />
                          <span>{billboard.location}, {billboard.city}</span>
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-3 border-t border-white/10 text-xs">
                        <div className="bg-white/[0.02] border border-white/5 rounded-lg p-2 flex flex-col">
                          <span className="text-[9px] text-white/40 uppercase font-semibold">Size</span>
                          <span className="font-bold text-white mt-0.5 font-mono">{billboard.size || `${billboard.width} × ${billboard.height}`}</span>
                        </div>
                        <div className="bg-white/[0.02] border border-white/5 rounded-lg p-2 flex flex-col">
                          <span className="text-[9px] text-white/40 uppercase font-semibold">Type</span>
                          <span className="font-bold text-cyan-300 mt-0.5 truncate">
                            {['ACU-AN-001', 'ACU-TN-002', 'ACU-VL-003', 'ACU-OMR-004'].includes(billboard.id) ? 'Static Billboard' : (billboard.type || 'Static Billboard')}
                          </span>
                        </div>
                      </div>

                      <div className="pt-2 flex items-center justify-between text-xs font-semibold text-cyan-400 group-hover:text-cyan-300 transition-colors">
                        <span>View Intelligence Dashboard</span>
                        <i className="fa-solid fa-arrow-right text-xs group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                  </div>
                ))}

                {/* Role-based Billboard Card Action */}
                {isAdmin ? (
                  <div
                    onClick={() => setShowAddModal(true)}
                    className="group bg-[#0e1424]/40 hover:bg-[#0e1424]/80 border-2 border-dashed border-blue-500/30 hover:border-blue-500/60 rounded-2xl p-6 transition-all duration-300 flex flex-col items-center justify-center gap-4 min-h-[300px] cursor-pointer text-center relative overflow-hidden shadow-lg hover:shadow-blue-500/10"
                  >
                    <div className="w-14 h-14 rounded-full bg-blue-500/10 border border-blue-500/30 group-hover:border-cyan-400 group-hover:bg-blue-500/20 group-hover:scale-110 flex items-center justify-center text-cyan-400 text-2xl transition-all duration-300">
                      <i className="fa-solid fa-plus" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <h3 className="text-base font-bold text-white group-hover:text-cyan-400 transition-colors font-heading">
                        + Add Billboard
                      </h3>
                      <p className="text-xs text-white/40 max-w-[200px]">
                        Register another billboard location asset into admin platform.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => { setShowContactModal(true); setContactSubmitted(false); }}
                    className="group bg-[#0e1424]/40 hover:bg-[#0e1424]/80 border-2 border-dashed border-cyan-500/30 hover:border-cyan-400/60 rounded-2xl p-6 transition-all duration-300 flex flex-col items-center justify-center gap-4 min-h-[300px] cursor-pointer text-center relative overflow-hidden shadow-lg hover:shadow-cyan-500/10"
                  >
                    <div className="w-14 h-14 rounded-full bg-cyan-500/10 border border-cyan-500/30 group-hover:border-cyan-400 group-hover:bg-cyan-500/20 group-hover:scale-110 flex items-center justify-center text-cyan-400 text-2xl transition-all duration-300 shadow-md shadow-cyan-500/10">
                      <i className="fa-solid fa-headset" />
                    </div>
                    <div className="flex flex-col gap-2 max-w-[240px]">
                      <h3 className="text-base font-bold text-white group-hover:text-cyan-400 transition-colors font-heading">
                        Add New Billboard
                      </h3>
                      <p className="text-xs text-white/50 leading-relaxed">
                        To add a billboard to your network, please <span className="text-cyan-300 font-semibold">contact the Aculion team</span> for onboarding & sensor setup.
                      </p>
                      <div className="inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-cyan-400 group-hover:text-cyan-300 mt-1">
                        <span>Contact Aculion Team</span>
                        <i className="fa-solid fa-arrow-right text-[10px] group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── BRAND VIEW ── */}
          {filterType === 'Brand' && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <i className="fa-solid fa-briefcase text-cyan-400 text-sm" />
                  <h2 className="text-lg font-bold font-heading text-white">Brand Partner Accounts</h2>
                  <span className="text-xs px-2 py-0.5 rounded-md bg-blue-500/10 text-cyan-400 border border-blue-500/20 font-mono">
                    {filteredBrands.length} Brands
                  </span>
                </div>
                {isAdmin ? (
                  <button
                    onClick={() => setShowAddBrandModal(true)}
                    className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <i className="fa-solid fa-plus text-[10px]" />
                    <span>Add Brand</span>
                  </button>
                ) : (
                  <button
                    onClick={() => { setShowContactModal(true); setContactSubmitted(false); }}
                    className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1.5 cursor-pointer bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 px-3 py-1.5 rounded-xl transition-all"
                  >
                    <i className="fa-solid fa-headset text-xs" />
                    <span>Contact Aculion Team</span>
                  </button>
                )}
              </div>

              {/* Brand Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredBrands.map((brand) => (
                  <div
                    key={brand.id}
                    className="group bg-[#0e1424]/80 hover:bg-[#131b30] border border-white/10 hover:border-cyan-500/40 rounded-2xl p-5 transition-all duration-300 shadow-xl flex flex-col justify-between gap-4 relative"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl bg-blue-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 text-lg flex-shrink-0">
                          <i className="fa-solid fa-building" />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <h3 className="text-base font-bold text-white group-hover:text-cyan-300 transition-colors font-heading truncate">
                            {brand.company}
                          </h3>
                          <span className="text-xs text-cyan-400 font-medium">{brand.name}</span>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-blue-500/10 text-cyan-300 border border-blue-500/20">
                        {brand.id}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-3 border-t border-white/10 text-xs">
                      <div className="bg-white/[0.02] border border-white/5 rounded-lg p-2 flex flex-col">
                        <span className="text-[9px] text-white/40 uppercase font-semibold">Category</span>
                        <span className="font-bold text-white mt-0.5 truncate">{brand.category}</span>
                      </div>
                      <div className="bg-white/[0.02] border border-white/5 rounded-lg p-2 flex flex-col">
                        <span className="text-[9px] text-white/40 uppercase font-semibold">Location Coverage</span>
                        <span className="font-bold text-emerald-400 mt-0.5 truncate">{brand.billboards}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs text-white/50 pt-1">
                      <span className="flex items-center gap-1.5 text-white/60">
                        <i className="fa-solid fa-envelope text-cyan-400 text-[10px]" />
                        <span className="truncate">{brand.email}</span>
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
                        {brand.status}
                      </span>
                    </div>
                  </div>
                ))}

                {/* Role-based Brand Card Action */}
                {isAdmin ? (
                  <div
                    onClick={() => setShowAddBrandModal(true)}
                    className="group bg-[#0e1424]/40 hover:bg-[#0e1424]/80 border-2 border-dashed border-cyan-500/30 hover:border-cyan-500/60 rounded-2xl p-6 transition-all duration-300 flex flex-col items-center justify-center gap-4 min-h-[220px] cursor-pointer text-center relative overflow-hidden shadow-lg hover:shadow-cyan-500/10"
                  >
                    <div className="w-14 h-14 rounded-full bg-cyan-500/10 border border-cyan-500/30 group-hover:border-cyan-400 group-hover:bg-cyan-500/20 group-hover:scale-110 flex items-center justify-center text-cyan-400 text-2xl transition-all duration-300">
                      <i className="fa-solid fa-plus" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <h3 className="text-base font-bold text-white group-hover:text-cyan-300 transition-colors font-heading">
                        + Add Brand
                      </h3>
                      <p className="text-xs text-white/40 max-w-[200px]">
                        Create another brand advertiser profile to assign campaign billboards.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => { setShowContactModal(true); setContactSubmitted(false); }}
                    className="group bg-[#0e1424]/40 hover:bg-[#0e1424]/80 border-2 border-dashed border-cyan-500/30 hover:border-cyan-400/60 rounded-2xl p-6 transition-all duration-300 flex flex-col items-center justify-center gap-4 min-h-[220px] cursor-pointer text-center relative overflow-hidden shadow-lg hover:shadow-cyan-500/10"
                  >
                    <div className="w-14 h-14 rounded-full bg-cyan-500/10 border border-cyan-500/30 group-hover:border-cyan-400 group-hover:bg-cyan-500/20 group-hover:scale-110 flex items-center justify-center text-cyan-400 text-2xl transition-all duration-300 shadow-md shadow-cyan-500/10">
                      <i className="fa-solid fa-headset" />
                    </div>
                    <div className="flex flex-col gap-2 max-w-[240px]">
                      <h3 className="text-base font-bold text-white group-hover:text-cyan-300 transition-colors font-heading">
                        Add Brand Partner
                      </h3>
                      <p className="text-xs text-white/50 leading-relaxed">
                        To onboard a brand advertiser, please <span className="text-cyan-300 font-semibold">contact the Aculion team</span> for campaign slot allocation.
                      </p>
                      <div className="inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-cyan-400 group-hover:text-cyan-300 mt-1">
                        <span>Contact Aculion Team</span>
                        <i className="fa-solid fa-arrow-right text-[10px] group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

        </section>
      </main>

      {/* ── MODAL 1: ADD NEW BILLBOARD (ADMIN ONLY) ── */}
      {showAddModal && isAdmin && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-6 overflow-hidden">
          <div className="bg-[#0e1424] border border-blue-500/30 rounded-2xl max-w-2xl w-full max-h-[85vh] sm:max-h-[90vh] shadow-2xl relative flex flex-col overflow-hidden my-auto">
            
            {/* FIXED HEADER */}
            <div className="p-5 sm:p-6 border-b border-white/10 flex-shrink-0 flex items-center justify-between bg-[#0e1424] z-10">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-cyan-400 text-base">
                  <i className="fa-solid fa-plus" />
                </div>
                <div>
                  <h3 className="text-lg font-bold font-heading text-white">Add New Billboard</h3>
                  <p className="text-xs text-white/50">Register a new media asset for location intelligence tracking.</p>
                </div>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-white/40 hover:text-white text-lg transition-colors p-1"
                aria-label="Close modal"
              >
                <i className="fa-solid fa-xmark" />
              </button>
            </div>

            {/* FORM CONTAINING SCROLLABLE BODY & FIXED FOOTER */}
            <form onSubmit={handleAddSubmit} className="flex-1 flex flex-col overflow-hidden" autoComplete="off">
              
              {/* SCROLLABLE BODY */}
              <div className="p-5 sm:p-6 overflow-y-auto flex-1 flex flex-col gap-4">
                
                {formError && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-red-400 text-xs flex items-center gap-2">
                    <i className="fa-solid fa-circle-exclamation" />
                    <span>{formError}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                  {/* ── OWNER NAME BAR & USER TYPE SELECTION ── */}
                  <div className="bg-[#12192e]/90 border border-cyan-500/30 rounded-xl p-4 sm:col-span-2 flex flex-col gap-3 backdrop-blur-md shadow-lg">
                    <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-white/10">
                      <span className="text-xs font-bold text-cyan-400 uppercase tracking-widest flex items-center gap-2 font-heading">
                        <i className="fa-solid fa-user-shield text-sm" /> Billboard Owner Account
                      </span>
                      <div className="flex items-center bg-[#090d18] p-1 rounded-lg border border-white/10 text-xs">
                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, ownerUserType: 'existing' }))}
                          className={`px-3 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                            formData.ownerUserType === 'existing'
                              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30'
                              : 'text-white/50 hover:text-white'
                          }`}
                        >
                          Existing User
                        </button>
                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, ownerUserType: 'new' }))}
                          className={`px-3 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                            formData.ownerUserType === 'new'
                              ? 'bg-cyan-600 text-white shadow-md shadow-cyan-500/30'
                              : 'text-white/50 hover:text-white'
                          }`}
                        >
                          New User
                        </button>
                      </div>
                    </div>

                    {formData.ownerUserType === 'existing' ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        <div className="flex flex-col gap-1.5 sm:col-span-2">
                          <label className="text-xs font-semibold text-white/70">Select Owner Name *</label>
                          <select
                            name="ownerNameSelect"
                            value={formData.ownerEmail}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (!val) {
                                setFormData(prev => ({ ...prev, ownerName: '', ownerEmail: '', ownerCompany: '' }));
                                return;
                              }
                              const selected = registeredOwners.find(o => o.email === val);
                              if (selected) {
                                setFormData(prev => ({
                                  ...prev,
                                  ownerName: selected.owner_name,
                                  ownerEmail: selected.email,
                                  ownerCompany: selected.company_name || ''
                                }));
                              }
                            }}
                            className="bg-[#141d33] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-blue-500 cursor-pointer"
                          >
                            <option value="">-- Choose Registered Owner Name --</option>
                            {registeredOwners.map(o => (
                              <option key={o.id} value={o.email}>
                                {o.owner_name} ({o.email})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="flex flex-col gap-1.5 sm:col-span-2">
                          <label className="text-xs font-semibold text-white/70">Owner Email ID *</label>
                          <input
                            type="email"
                            name="ownerEmail"
                            placeholder="e.g. owner@mediaooh.com"
                            value={formData.ownerEmail}
                            onChange={handleInputChange}
                            autoComplete="off"
                            className="bg-[#141d33] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                            required={formData.ownerUserType === 'existing'}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-semibold text-white/70">New Owner Name *</label>
                          <input
                            type="text"
                            name="ownerName"
                            placeholder="e.g. Rajesh Kumar"
                            value={formData.ownerName}
                            onChange={handleInputChange}
                            autoComplete="off"
                            className="bg-[#141d33] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                            required={formData.ownerUserType === 'new'}
                          />
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-semibold text-white/70">Company / Media Network</label>
                          <input
                            type="text"
                            name="ownerCompany"
                            placeholder="e.g. Skyline Outdoor Media"
                            value={formData.ownerCompany}
                            onChange={handleInputChange}
                            autoComplete="off"
                            className="bg-[#141d33] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                          />
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-semibold text-white/70">Owner Email ID *</label>
                          <input
                            type="email"
                            name="ownerEmail"
                            placeholder="e.g. rajesh@skylinemedia.com"
                            value={formData.ownerEmail}
                            onChange={handleInputChange}
                            autoComplete="off"
                            className="bg-[#141d33] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
                            required={formData.ownerUserType === 'new'}
                          />
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-semibold text-white/70">Owner Password *</label>
                          <input
                            type="password"
                            name="ownerPassword"
                            placeholder="••••••••"
                            value={formData.ownerPassword}
                            onChange={handleInputChange}
                            autoComplete="new-password"
                            className="bg-[#141d33] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
                            required={formData.ownerUserType === 'new'}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ── BILLBOARD NAME & ID ── */}
                  <div className="flex flex-col gap-1.5 sm:col-span-2">
                    <label className="text-xs font-semibold text-white/70">Billboard Name *</label>
                    <input
                      type="text"
                      name="name"
                      placeholder="e.g. Anna Nagar – Shanthi Colony Junction"
                      value={formData.name}
                      onChange={handleInputChange}
                      autoComplete="off"
                      className="bg-[#141d33] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-blue-500"
                      required
                    />
                  </div>

                  <div className="flex flex-col gap-1.5 sm:col-span-2">
                    <label className="text-xs font-semibold text-white/70">Billboard ID *</label>
                    <input
                      type="text"
                      name="id"
                      placeholder="e.g. ACU-AN-001"
                      value={formData.id}
                      onChange={handleInputChange}
                      autoComplete="off"
                      className="bg-[#141d33] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                      required
                    />
                  </div>

                  {/* ── SEPARATE CAMERA CODES (CAMERA FF & CAMERA BF) ── */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-white/70">Camera FF Code (Front Facing) *</label>
                    <input
                      type="text"
                      name="cameraCodeFF"
                      placeholder="e.g. CAM-FF-0001"
                      value={formData.cameraCodeFF || ''}
                      onChange={handleInputChange}
                      autoComplete="off"
                      className="bg-[#141d33] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                      required
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-white/70">Camera BF Code (Back Facing) *</label>
                    <input
                      type="text"
                      name="cameraCodeBF"
                      placeholder="e.g. CAM-BF-0001"
                      value={formData.cameraCodeBF || ''}
                      onChange={handleInputChange}
                      autoComplete="off"
                      className="bg-[#141d33] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                      required
                    />
                  </div>

                  <div className="flex flex-col gap-1.5 sm:col-span-2">
                    <label className="text-xs font-semibold text-white/70">Billboard Type</label>
                    <select
                      name="type"
                      value={formData.type}
                      onChange={handleInputChange}
                      className="bg-[#141d33] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-blue-500 cursor-pointer"
                    >
                      <option value="Digital Billboard">Digital Billboard</option>
                      <option value="Static Billboard">Static Billboard</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5 sm:col-span-2">
                    <label className="text-xs font-semibold text-white/70">Location Landmark *</label>
                    <input
                      type="text"
                      name="location"
                      placeholder="e.g. Shanthi Colony Junction, Anna Nagar"
                      value={formData.location}
                      onChange={handleInputChange}
                      autoComplete="off"
                      className="bg-[#141d33] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-blue-500"
                      required
                    />
                  </div>

                  <div className="flex flex-col gap-1.5 sm:col-span-2">
                    <label className="text-xs font-semibold text-white/70">Street Address *</label>
                    <input
                      type="text"
                      name="address"
                      placeholder="e.g. 2nd Avenue, Shanthi Colony, Chennai - 600040"
                      value={formData.address}
                      onChange={handleInputChange}
                      autoComplete="off"
                      className="bg-[#141d33] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-blue-500"
                      required
                    />
                  </div>

                  {/* ── LATITUDE & LONGITUDE ── */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-white/70">Latitude *</label>
                    <input
                      type="text"
                      name="latitude"
                      placeholder="e.g. 13.0827"
                      value={formData.latitude}
                      onChange={handleInputChange}
                      autoComplete="off"
                      className="bg-[#141d33] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white font-mono placeholder-white/30 focus:outline-none focus:border-blue-500"
                      required
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-white/70">Longitude *</label>
                    <input
                      type="text"
                      name="longitude"
                      placeholder="e.g. 80.2707"
                      value={formData.longitude}
                      onChange={handleInputChange}
                      autoComplete="off"
                      className="bg-[#141d33] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white font-mono placeholder-white/30 focus:outline-none focus:border-blue-500"
                      required
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-white/70">City</label>
                    <input
                      type="text"
                      name="city"
                      value={formData.city}
                      onChange={handleInputChange}
                      autoComplete="off"
                      className="bg-[#141d33] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-white/70">Status</label>
                    <select
                      name="status"
                      value={formData.status}
                      onChange={handleInputChange}
                      className="bg-[#141d33] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-blue-500 cursor-pointer"
                    >
                      <option value="Active">Active</option>
                      <option value="Maintenance">Maintenance</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* FIXED FOOTER BUTTONS */}
              <div className="p-4 sm:px-6 border-t border-white/10 flex items-center justify-end gap-3 flex-shrink-0 bg-[#0b101d]">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-xs font-semibold transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white text-xs font-semibold shadow-lg shadow-blue-500/25 transition-all cursor-pointer"
                >
                  Add Billboard
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* ── MODAL 2: ADD NEW BRAND (ADMIN ONLY) ── */}
      {showAddBrandModal && isAdmin && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-6 overflow-hidden">
          <div className="bg-[#0e1424] border border-cyan-500/30 rounded-2xl max-w-xl w-full max-h-[85vh] sm:max-h-[90vh] shadow-2xl relative flex flex-col overflow-hidden my-auto">
            
            {/* FIXED HEADER */}
            <div className="p-5 sm:p-6 border-b border-white/10 flex-shrink-0 flex items-center justify-between bg-[#0e1424] z-10">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 text-base">
                  <i className="fa-solid fa-plus" />
                </div>
                <div>
                  <h3 className="text-lg font-bold font-heading text-white">Add New Brand Partner</h3>
                  <p className="text-xs text-white/50">Register a new brand advertiser for campaign management.</p>
                </div>
              </div>
              <button
                onClick={() => setShowAddBrandModal(false)}
                className="text-white/40 hover:text-white text-lg transition-colors p-1"
                aria-label="Close modal"
              >
                <i className="fa-solid fa-xmark" />
              </button>
            </div>

            {/* FORM WITH SCROLLABLE BODY & FIXED FOOTER */}
            <form onSubmit={handleBrandSubmit} className="flex-1 flex flex-col overflow-hidden" autoComplete="off">
              
              {/* SCROLLABLE BODY */}
              <div className="p-5 sm:p-6 overflow-y-auto flex-1 flex flex-col gap-4">
                {brandFormError && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-red-400 text-xs flex items-center gap-2">
                    <i className="fa-solid fa-circle-exclamation" />
                    <span>{brandFormError}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5 sm:col-span-2">
                    <label className="text-xs font-semibold text-white/70">Campaign / Brand Title *</label>
                    <input
                      type="text"
                      name="name"
                      placeholder="e.g. Nike Air Max OOH Campaign"
                      value={brandFormData.name}
                      onChange={handleBrandInputChange}
                      autoComplete="off"
                      className="bg-[#141d33] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-cyan-500"
                      required
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-white/70">Company Name *</label>
                    <input
                      type="text"
                      name="company"
                      placeholder="e.g. Nike India Pvt. Ltd."
                      value={brandFormData.company}
                      onChange={handleBrandInputChange}
                      autoComplete="off"
                      className="bg-[#141d33] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                      required
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-white/70">Brand User Name *</label>
                    <input
                      type="text"
                      name="username"
                      placeholder="e.g. Rahul Sharma"
                      value={brandFormData.username}
                      onChange={handleBrandInputChange}
                      autoComplete="off"
                      className="bg-[#141d33] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                      required
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-white/70">Contact Email *</label>
                    <input
                      type="email"
                      name="email"
                      placeholder="e.g. ads@nike.com"
                      value={brandFormData.email}
                      onChange={handleBrandInputChange}
                      autoComplete="off"
                      className="bg-[#141d33] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
                      required
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-white/70">Account Password *</label>
                    <input
                      type="password"
                      name="password"
                      placeholder="••••••••"
                      value={brandFormData.password}
                      onChange={handleBrandInputChange}
                      autoComplete="new-password"
                      className="bg-[#141d33] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
                      required
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-white/70">Industry / Category</label>
                    <input
                      type="text"
                      name="category"
                      placeholder="e.g. Retail & Apparel"
                      value={brandFormData.category}
                      onChange={handleBrandInputChange}
                      autoComplete="off"
                      className="bg-[#141d33] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-white/70">Phone Number</label>
                    <input
                      type="text"
                      name="phone"
                      placeholder="e.g. +91 98765 43210"
                      value={brandFormData.phone}
                      onChange={handleBrandInputChange}
                      autoComplete="off"
                      className="bg-[#141d33] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5 sm:col-span-2">
                    <label className="text-xs font-semibold text-white/70">Target Coverage Range</label>
                    <input
                      type="text"
                      name="billboards"
                      placeholder="e.g. Anna Nagar & T. Nagar (15 Billboards)"
                      value={brandFormData.billboards}
                      onChange={handleBrandInputChange}
                      autoComplete="off"
                      className="bg-[#141d33] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>
              </div>

              {/* FIXED FOOTER */}
              <div className="p-4 sm:px-6 border-t border-white/10 flex items-center justify-end gap-3 flex-shrink-0 bg-[#0b101d]">
                <button
                  type="button"
                  onClick={() => setShowAddBrandModal(false)}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-xs font-semibold transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white text-xs font-semibold shadow-lg shadow-blue-500/25 transition-all cursor-pointer"
                >
                  Add Brand Partner
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* ── MODAL 3: CONTACT ACULION TEAM (FOR BILLBOARD / BRAND OWNERS) ── */}
      {showContactModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-6 overflow-hidden">
          <div className="bg-[#0e1424] border border-cyan-500/30 rounded-2xl max-w-xl w-full max-h-[90vh] shadow-2xl relative flex flex-col overflow-hidden my-auto">
            
            {/* FIXED HEADER */}
            <div className="p-5 sm:p-6 border-b border-white/10 flex-shrink-0 flex items-center justify-between bg-[#0e1424] z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 text-lg shadow-lg shadow-cyan-500/10">
                  <i className="fa-solid fa-headset" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold font-heading text-white">Contact Aculion Team</h3>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 font-semibold uppercase tracking-wider">
                      Partner Desk
                    </span>
                  </div>
                  <p className="text-xs text-white/50 mt-0.5">Media asset onboarding & hardware telemetry provisioning</p>
                </div>
              </div>
              <button
                onClick={() => { setShowContactModal(false); setContactSubmitted(false); }}
                className="text-white/40 hover:text-white text-lg transition-colors p-1 cursor-pointer"
                aria-label="Close modal"
              >
                <i className="fa-solid fa-xmark" />
              </button>
            </div>

            {/* SCROLLABLE BODY */}
            <div className="p-5 sm:p-6 overflow-y-auto flex-1 flex flex-col gap-5">
              
              {/* Informative notice card */}
              <div className="bg-gradient-to-r from-blue-900/30 to-cyan-900/20 border border-cyan-500/30 rounded-xl p-4 flex items-start gap-3.5">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-300 text-sm flex-shrink-0 mt-0.5">
                  <i className="fa-solid fa-tower-broadcast" />
                </div>
                <div className="flex flex-col gap-1 text-xs">
                  <span className="font-bold text-cyan-300 uppercase tracking-wider text-[11px]">Billboard Onboarding Notice</span>
                  <p className="text-white/70 leading-relaxed">
                    To maintain real-time vehicle telemetry, camera exposure stats, and PostGIS verification, all new billboard installations are provisioned directly by the Aculion engineering team.
                  </p>
                </div>
              </div>

              {/* Direct Contact Channels Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-[#12192e]/90 border border-white/10 hover:border-cyan-500/40 rounded-xl p-3.5 flex flex-col gap-2 transition-all">
                  <div className="flex items-center gap-2.5 text-cyan-400">
                    <i className="fa-solid fa-envelope text-sm" />
                    <span className="text-[11px] font-bold uppercase tracking-wider text-white/60">Email Support</span>
                  </div>
                  <a
                    href={`mailto:contact@aculion.com?subject=Billboard%20Onboarding%20Request%20-%20${encodeURIComponent(user?.name || 'Partner')}`}
                    className="text-xs font-mono font-bold text-white hover:text-cyan-300 transition-colors truncate"
                  >
                    contact@aculion.com
                  </a>
                  <span className="text-[10px] text-white/40">Response within 24 hours</span>
                </div>

                <div className="bg-[#12192e]/90 border border-white/10 hover:border-cyan-500/40 rounded-xl p-3.5 flex flex-col gap-2 transition-all">
                  <div className="flex items-center gap-2.5 text-emerald-400">
                    <i className="fa-solid fa-phone text-sm" />
                    <span className="text-[11px] font-bold uppercase tracking-wider text-white/60">Operations Helpline</span>
                  </div>
                  <a
                    href="tel:+919876543210"
                    className="text-xs font-mono font-bold text-white hover:text-emerald-300 transition-colors"
                  >
                    +91 98765 43210
                  </a>
                  <span className="text-[10px] text-white/40">Mon - Sat: 9:00 AM - 7:00 PM IST</span>
                </div>
              </div>

              {/* Quick Inquiry Form */}
              <div className="bg-[#12192e]/80 border border-white/10 rounded-xl p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between pb-2 border-b border-white/10">
                  <span className="text-xs font-bold text-white tracking-wide uppercase flex items-center gap-2 font-heading">
                    <i className="fa-solid fa-paper-plane text-cyan-400 text-xs" /> Submit Onboarding Request
                  </span>
                  <span className="text-[10px] text-white/40">Direct Dispatch</span>
                </div>

                {contactSubmitted ? (
                  <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex flex-col items-center justify-center text-center gap-2 py-6">
                    <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 text-lg">
                      <i className="fa-solid fa-check" />
                    </div>
                    <h4 className="text-sm font-bold text-white">Request Received Successfully!</h4>
                    <p className="text-xs text-white/60 max-w-sm">
                      Thank you! An Aculion representative will review your location details and contact you shortly at <span className="text-emerald-300 font-mono">{contactFormData.phone || user?.email || 'your registered contact'}</span>.
                    </p>
                    <button
                      type="button"
                      onClick={() => { setContactSubmitted(false); setShowContactModal(false); }}
                      className="mt-2 px-4 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-semibold cursor-pointer transition-all"
                    >
                      Done
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleContactSubmit} className="flex flex-col gap-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1">
                        <label className="text-[11px] font-semibold text-white/70">Proposed Location / Landmark *</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Anna Nagar 2nd Avenue, Chennai"
                          value={contactFormData.location}
                          onChange={(e) => setContactFormData(prev => ({ ...prev, location: e.target.value }))}
                          className="bg-[#141d33] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-cyan-500"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[11px] font-semibold text-white/70">Contact Phone Number *</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. +91 98765 43210"
                          value={contactFormData.phone}
                          onChange={(e) => setContactFormData(prev => ({ ...prev, phone: e.target.value }))}
                          className="bg-[#141d33] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-white/30 font-mono focus:outline-none focus:border-cyan-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1">
                        <label className="text-[11px] font-semibold text-white/70">Billboard Type</label>
                        <select
                          value={contactFormData.billboardType}
                          onChange={(e) => setContactFormData(prev => ({ ...prev, billboardType: e.target.value }))}
                          className="bg-[#141d33] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
                        >
                          <option value="Digital Billboard">Digital Billboard (LED)</option>
                          <option value="Static Billboard">Static Billboard (Unipole / Traditional)</option>
                          <option value="Transit Media">Transit / Gantry Media</option>
                        </select>
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[11px] font-semibold text-white/70">Approx Size / Dimensions</label>
                        <input
                          type="text"
                          placeholder="e.g. 40 ft × 20 ft"
                          value={contactFormData.dimensions}
                          onChange={(e) => setContactFormData(prev => ({ ...prev, dimensions: e.target.value }))}
                          className="bg-[#141d33] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-cyan-500"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-semibold text-white/70">Additional Details / Notes</label>
                      <textarea
                        rows="2"
                        placeholder="e.g. Existing gantry facing high-traffic junction, seeking camera telemetry setup."
                        value={contactFormData.notes}
                        onChange={(e) => setContactFormData(prev => ({ ...prev, notes: e.target.value }))}
                        className="bg-[#141d33] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-cyan-500 resize-none"
                      />
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setShowContactModal(false)}
                        className="px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-xs font-semibold transition-all cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={contactSubmitting}
                        className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white text-xs font-semibold shadow-lg shadow-blue-500/25 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        {contactSubmitting ? (
                          <>
                            <i className="fa-solid fa-spinner animate-spin text-xs" />
                            <span>Sending...</span>
                          </>
                        ) : (
                          <>
                            <i className="fa-solid fa-paper-plane text-xs" />
                            <span>Submit Onboarding Request</span>
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                )}
              </div>

            </div>

            {/* FIXED FOOTER */}
            <div className="p-4 sm:px-6 border-t border-white/10 flex items-center justify-between flex-shrink-0 bg-[#0b101d] text-xs">
              <span className="text-white/40 text-[11px] flex items-center gap-1.5">
                <i className="fa-solid fa-shield-halved text-cyan-400" /> Aculion Platform Support
              </span>
              <a
                href={`mailto:contact@aculion.com?subject=Billboard%20Onboarding%20Request%20-%20${encodeURIComponent(user?.name || 'Partner')}`}
                className="text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1.5 transition-colors"
              >
                <span>Direct Mail</span>
                <i className="fa-solid fa-arrow-up-right-from-square text-[10px]" />
              </a>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}

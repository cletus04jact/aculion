import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

// Reusing number animator from BrandPortal
function AnimNum({ value, suffix = '', precision = 0 }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let start = 0;
    const end = parseFloat(value);
    if (isNaN(end)) return;
    const duration = 800;
    const t0 = performance.now();
    const tick = (now) => {
      const p = Math.min((now - t0) / duration, 1);
      const ease = p * (2 - p);
      setDisplay(start + (end - start) * ease);
      if (p < 1) requestAnimationFrame(tick);
      else setDisplay(end);
    };
    requestAnimationFrame(tick);
  }, [value]);
  const fmt = precision > 0 ? display.toFixed(precision) : Math.floor(display).toLocaleString();
  return <span>{fmt}{suffix}</span>;
}

export default function AdminDashboard({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState('status');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [clock, setClock] = useState('');
  
  // Database backed owners list
  const [userList, setUserList] = useState([]);
  const [billboardCount, setBillboardCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Secure User Creation Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newOwnerName, setNewOwnerName] = useState('');
  const [newCompanyName, setNewCompanyName] = useState('');
  const [createError, setCreateError] = useState('');
  const [createSuccess, setCreateSuccess] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // System monitoring states
  const [edgeNodes, setEdgeNodes] = useState(42);
  const [systemLoad, setSystemLoad] = useState(34.2);
  const [bandwidth, setBandwidth] = useState(1.4);

  useEffect(() => {
    window.scrollTo(0, 0);
    const tick = () => {
      const n = new Date();
      setClock(`${n.getHours().toString().padStart(2, '0')}:${n.getMinutes().toString().padStart(2, '0')}:${n.getSeconds().toString().padStart(2, '0')}`);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  // Fetch users and billboards count from DB
  const fetchDbData = async () => {
    try {
      // 1. Fetch owners from billboard_owners table
      const { data: owners, error: ownersErr } = await supabase
        .from('billboard_owners')
        .select('*')
        .order('created_at', { ascending: false });

      if (ownersErr) throw ownersErr;
      setUserList(owners || []);

      // 2. Fetch billboards count
      const { count, error: bbErr } = await supabase
        .from('billboards')
        .select('*', { count: 'exact', head: true });

      if (bbErr) throw bbErr;
      setBillboardCount(count || 0);
    } catch (err) {
      console.error('[AdminDashboard] Error fetching database data:', err);
    }
  };

  useEffect(() => {
    fetchDbData();
  }, [activeTab]);

  // Simulate server load fluctuations
  useEffect(() => {
    const interval = setInterval(() => {
      setSystemLoad(p => {
        const d = (Math.random() - 0.5) * 4;
        return Math.min(99, Math.max(10, +(p + d).toFixed(1)));
      });
      setBandwidth(p => {
        const d = (Math.random() - 0.45) * 0.15;
        return Math.min(10, Math.max(0.5, +(p + d).toFixed(2)));
      });
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const deleteUser = async (idToDelete, emailToDelete) => {
    if (emailToDelete === user.email) {
      alert("You cannot delete your own Administrator account!");
      return;
    }
    if (window.confirm(`Are you sure you want to remove user account ${emailToDelete}?`)) {
      try {
        const { error } = await supabase
          .from('billboard_owners')
          .delete()
          .eq('id', idToDelete);

        if (error) throw error;
        
        // Refresh local list
        setUserList(prev => prev.filter(u => u.id !== idToDelete));
      } catch (err) {
        console.error('Revoke access error:', err);
        alert(`Failed to revoke access: ${err.message || err}`);
      }
    }
  };

  const handleCreateOwnerSubmit = async (e) => {
    e.preventDefault();
    setCreateError('');
    setCreateSuccess('');
    setIsCreating(true);

    if (!newEmail.trim() || !newPassword.trim() || !newOwnerName.trim()) {
      setCreateError('Please fill in email, password, and owner name.');
      setIsCreating(false);
      return;
    }

    try {
      const session = (await supabase.auth.getSession()).data.session;
      const token = session?.access_token;
      
      const response = await fetch(`${API_BASE_URL}/api/location/v1/admin/create-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          email: newEmail.trim().toLowerCase(),
          password: newPassword,
          owner_name: newOwnerName.trim(),
          company_name: newCompanyName.trim() || 'Aculion Owner Partner',
          role: 'Media Owner (Billboard Operator)'
        })
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.detail || 'Failed to create user account.');
      }

      setCreateSuccess('New Billboard Owner profile registered successfully!');
      setNewEmail('');
      setNewPassword('');
      setNewOwnerName('');
      setNewCompanyName('');
      
      // Refresh user list
      fetchDbData();
      
      setTimeout(() => {
        setShowCreateModal(false);
        setCreateSuccess('');
      }, 1500);
    } catch (err) {
      console.error('Error creating owner:', err);
      setCreateError(err.message || 'An error occurred during account creation.');
    } finally {
      setIsCreating(false);
    }
  };

  const navItems = [
    { key: 'status', label: 'System Status', icon: 'fa-server' },
    { key: 'users', label: 'User Accounts', icon: 'fa-users-gear' },
    { key: 'nodes', label: 'Edge Nodes', icon: 'fa-microchip' },
    { key: 'logs', label: 'Security Logs', icon: 'fa-shield-halved' }
  ];

  const filteredUsers = userList.filter(u => 
    (u.owner_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (u.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (u.company_name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="brand-portal admin-portal">
      {/* Sidebar */}
      <aside className={`brand-sidebar ${sidebarCollapsed ? 'collapsed' : ''} ${mobileSidebarOpen ? 'mobile-open' : ''}`}>
        <div className="brand-sidebar-header">
          {sidebarCollapsed ? (
            <button 
              className="brand-sidebar-expand-btn" 
              onClick={() => setSidebarCollapsed(false)}
              aria-label="Expand sidebar"
            >
              <i className="fa-solid fa-angles-right"></i>
            </button>
          ) : (
            <>
              <a className="brand-sidebar-logo" onClick={() => setActiveTab('status')}>
                ACULION<span className="logo-dot"></span>
              </a>
              <span className="brand-sidebar-badge" style={{ color: '#8b5cf6', borderColor: 'rgba(139, 92, 246, 0.4)', background: 'rgba(139, 92, 246, 0.15)' }}>Admin</span>
              <button className="brand-sidebar-toggle" onClick={() => { setSidebarCollapsed(true); setMobileSidebarOpen(false); }}>
                <i className="fa-solid fa-angles-left"></i>
              </button>
            </>
          )}
        </div>
        <nav className="brand-sidebar-nav">
          {navItems.map(item => (
            <button
              key={item.key}
              className={`brand-nav-item ${activeTab === item.key ? 'active' : ''}`}
              onClick={() => { setActiveTab(item.key); setMobileSidebarOpen(false); }}
              title={sidebarCollapsed ? item.label : ''}
            >
              <i className={`fa-solid ${item.icon}`}></i>
              {!sidebarCollapsed && <span>{item.label}</span>}
            </button>
          ))}
        </nav>
        <div className="brand-sidebar-footer">
          <button className="brand-nav-item logout-btn" onClick={onLogout}>
            <i className="fa-solid fa-right-from-bracket"></i>
            {!sidebarCollapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Main Container */}
      <div className={`brand-main ${sidebarCollapsed ? 'expanded' : ''}`}>
        {/* Topbar */}
        <header className="brand-topbar">
          <div className="brand-topbar-left">
            <button className="brand-mobile-menu-btn" onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}>
              <i className="fa-solid fa-bars"></i>
            </button>
            <h1 className="brand-page-title">
              {navItems.find(n => n.key === activeTab)?.label || 'Console'}
            </h1>
          </div>
          <div className="brand-topbar-right">
            <span className="brand-topbar-clock">
              <i className="fa-solid fa-clock"></i> {clock}
            </span>
            <span className="brand-live-badge">
              <span className="brand-live-dot"></span> SECURE
            </span>
            <div className="brand-topbar-user">
              <div className="brand-topbar-avatar" style={{ background: 'linear-gradient(135deg, #8b5cf6, #ef4444)' }}>
                {user?.name?.charAt(0)?.toUpperCase() || 'A'}
              </div>
              <div className="brand-topbar-user-info">
                <span className="brand-topbar-username">{user?.name || 'Admin'}</span>
                <span className="brand-topbar-company">Aculion Cloud</span>
              </div>
            </div>
          </div>
        </header>

        {/* Scrollable Content */}
        <div className="brand-content">
          {activeTab === 'status' && (
            <div className="brand-tab-content fade-in-content">
              {/* KPIs */}
              <div className="brand-kpi-grid">
                <div className="brand-kpi-card">
                  <div className="brand-kpi-icon" style={{ color: '#00f0ff' }}><i className="fa-solid fa-server"></i></div>
                  <div className="brand-kpi-data">
                    <span className="brand-kpi-label">Edge Node Streams</span>
                    <span className="brand-kpi-value"><AnimNum value={edgeNodes} /></span>
                  </div>
                </div>
                <div className="brand-kpi-card">
                  <div className="brand-kpi-icon" style={{ color: '#10b981' }}><i className="fa-solid fa-users"></i></div>
                  <div className="brand-kpi-data">
                    <span className="brand-kpi-label">Registered Accounts</span>
                    <span className="brand-kpi-value"><AnimNum value={userList.length} /></span>
                  </div>
                </div>
                <div className="brand-kpi-card">
                  <div className="brand-kpi-icon" style={{ color: '#f59e0b' }}><i className="fa-solid fa-gauge"></i></div>
                  <div className="brand-kpi-data">
                    <span className="brand-kpi-label">System Cpu Load</span>
                    <span className="brand-kpi-value"><AnimNum value={systemLoad} suffix="%" precision={1} /></span>
                  </div>
                </div>
                <div className="brand-kpi-card">
                  <div className="brand-kpi-icon" style={{ color: '#ef4444' }}><i className="fa-solid fa-network-wired"></i></div>
                  <div className="brand-kpi-data">
                    <span className="brand-kpi-label">Active Billboards</span>
                    <span className="brand-kpi-value"><AnimNum value={billboardCount} /></span>
                  </div>
                </div>
              </div>

              {/* Status Section */}
              <div className="brand-card" style={{ marginTop: 24 }}>
                <div className="brand-card-header">
                  <h3><i className="fa-solid fa-circle-check text-success"></i> Enterprise Core Services Status</h3>
                </div>
                <div style={{ marginTop: 20 }}>
                  {[
                    { service: 'Authentication Gateway (JWT/OAuth)', status: 'Active & Operational', load: '12%', color: '--success-green' },
                    { service: 'Pedestrian AI Inference Node Pipeline', status: 'Active & Ingesting', load: '45%', color: '--success-green' },
                    { service: 'GDPR Real-time Compliance Blur Service', status: 'Active & Operational', load: '68%', color: '--success-green' },
                    { service: 'Holographic Analytics Storage Cluster', status: 'Active & Synced', load: '24%', color: '--success-green' },
                    { service: 'FormSubmit Email Verification Microservice', status: 'Active & Operational', load: '2%', color: '--success-green' }
                  ].map(s => (
                    <div key={s.service} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--graphite-border)' }}>
                      <div>
                        <strong style={{ display: 'block', color: 'var(--text-white)' }}>{s.service}</strong>
                        <span style={{ fontSize: 12, color: `var(${s.color})` }}>● {s.status}</span>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Load: {s.load}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'users' && (
            <div className="brand-tab-content fade-in-content">
              <div className="brand-card">
                <div className="brand-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
                  <h3><i className="fa-solid fa-users-gear"></i> User Account Control Directory</h3>
                  
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <button
                      onClick={() => setShowCreateModal(true)}
                      style={{
                        padding: '8px 16px',
                        background: 'linear-gradient(135deg, #8b5cf6, #ef4444)',
                        border: 'none',
                        color: '#fff',
                        borderRadius: 6,
                        cursor: 'pointer',
                        fontSize: 13,
                        fontWeight: 600
                      }}
                    >
                      + Create Owner Account
                    </button>

                    <div style={{ position: 'relative' }}>
                      <i className="fa-solid fa-magnifying-glass" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: 13 }}></i>
                      <input
                        type="text"
                        placeholder="Search accounts..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{
                          padding: '8px 12px 8px 34px',
                          background: 'var(--bg-midnight)',
                          border: '1px solid var(--graphite-border)',
                          color: '#fff',
                          borderRadius: 6,
                          outline: 'none',
                          fontSize: 13,
                          width: 200
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div style={{ overflowX: 'auto', marginTop: 24 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: 600 }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--graphite-border)', color: 'var(--text-muted)', fontSize: 12, textTransform: 'uppercase' }}>
                        <th style={{ padding: '12px 8px' }}>User Details</th>
                        <th style={{ padding: '12px 8px' }}>Company</th>
                        <th style={{ padding: '12px 8px' }}>Role</th>
                        <th style={{ padding: '12px 8px', textAlign: 'right' }}>Manage Access</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map((u, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', fontSize: 14 }}>
                          <td style={{ padding: '16px 8px' }}>
                            <div style={{ fontWeight: 600, color: 'var(--text-white)' }}>{u.owner_name || 'No Name'}</div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{u.email}</div>
                          </td>
                          <td style={{ padding: '16px 8px', color: 'var(--text-light)' }}>{u.company_name || '—'}</td>
                          <td style={{ padding: '16px 8px' }}>
                            <span style={{
                              fontSize: 11,
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              padding: '2px 8px',
                              borderRadius: 4,
                              background: 'rgba(16, 185, 129, 0.15)',
                              color: 'var(--success-green)',
                              border: '1px solid rgba(16, 185, 129, 0.3)'
                            }}>
                              Media Owner
                            </span>
                          </td>
                          <td style={{ padding: '16px 8px', textAlign: 'right' }}>
                            <button
                              onClick={() => deleteUser(u.id, u.email)}
                              style={{
                                background: 'rgba(239, 68, 68, 0.1)',
                                color: 'var(--danger-red)',
                                border: '1px solid rgba(239, 68, 68, 0.25)',
                                padding: '6px 12px',
                                borderRadius: 6,
                                cursor: 'pointer',
                                fontSize: 12,
                                fontWeight: 600,
                                transition: 'var(--transition-smooth)'
                              }}
                              onMouseOver={(e) => { e.currentTarget.style.background = 'var(--danger-red)'; e.currentTarget.style.color = '#fff'; }}
                              onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'; e.currentTarget.style.color = 'var(--danger-red)'; }}
                            >
                              Revoke Access
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'nodes' && (
            <div className="brand-tab-content fade-in-content">
              <div className="brand-card">
                <div className="brand-card-header">
                  <h3><i className="fa-solid fa-microchip"></i> Active Edge Computing AI Node Streams</h3>
                </div>
                <div style={{ marginTop: 24 }}>
                  {[
                    { id: 'NODE-ANS-01', location: 'Anna Salai Central, Chennai', model: 'YOLOv8x Pedestrian (FP16)', fps: '29.8 fps', ping: '14ms', status: 'Online' },
                    { id: 'NODE-ANS-02', location: 'Anna Salai Billboard South, Chennai', model: 'YOLOv8x Pedestrian (FP16)', fps: '30.0 fps', ping: '12ms', status: 'Online' },
                    { id: 'NODE-LND-01', location: 'Piccadilly Circus High Rise, London', model: 'YOLOv8x Vehicle+Ped (FP16)', fps: '24.4 fps', ping: '42ms', status: 'Online' },
                    { id: 'NODE-BLR-01', location: 'MG Road Metro Crossing, Bangalore', model: 'YOLOv8n Pedestrian (INT8)', fps: '60.0 fps', ping: '8ms', status: 'Online' },
                    { id: 'NODE-MUM-01', location: 'Marine Drive Gateway Premium, Mumbai', model: 'YOLOv8x Vehicle+Ped (FP16)', fps: '28.2 fps', ping: '19ms', status: 'Online' }
                  ].map(node => (
                    <div key={node.id} style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--graphite-border)', borderRadius: 8, marginBottom: 12, display: 'flex', justifycontent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontWeight: 'bold', color: '#fff' }}>{node.id}</span>
                          <span style={{ fontSize: 11, background: 'rgba(16, 185, 129, 0.15)', color: 'var(--success-green)', padding: '1px 6px', borderRadius: 4, fontWeight: 'bold' }}>{node.status}</span>
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}><i className="fa-solid fa-location-dot"></i> {node.location}</div>
                      </div>
                      <div>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Model: {node.model}</span>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ color: '#fff', fontSize: 14, fontWeight: 'bold' }}>{node.fps}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Latency: {node.ping}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'logs' && (
            <div className="brand-tab-content fade-in-content">
              <div className="brand-card">
                <div className="brand-card-header">
                  <h3><i className="fa-solid fa-shield-halved"></i> Global Security Audit Trails</h3>
                </div>
                <div style={{ marginTop: 24, fontFamily: 'monospace', fontSize: 12, color: '#00ff66', background: '#040508', padding: 20, borderRadius: 8, border: '1px solid var(--graphite-border)', lineHeight: 1.6, maxHeight: 400, overflowY: 'auto' }}>
                  <div>[2026-06-27 12:12:04] AUTH: Administrator session token successfully signed and dispatched for user {user?.email}.</div>
                  <div>[2026-06-27 12:05:42] SYSTEM: Synced local database nodes from Supabase databases.</div>
                  <div>[2026-06-27 11:59:18] COMPLIANCE: Triggered auto-anonymization check on active node streams. 100% compliant.</div>
                  <div>[2026-06-27 11:48:33] NETWORK: Node NODE-BLR-01 completed model deployment (YOLOv8n Pedestrian).</div>
                  <div>[2026-06-27 11:34:02] COMPLIANCE: Faces and plates matching index cleared from edge cache.</div>
                  <div>[2026-06-27 11:12:59] SECURE: Access token verification succeeded. Admin console loaded.</div>
                  <div>[2026-06-27 10:45:00] INIT: Aculion Security Subsystem initialized. Operational logs open.</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* SECURE OWNER USER CREATION DIALOG MODAL */}
      {showCreateModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.8)',
          backdropFilter: 'blur(8px)',
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16
        }}>
          <div style={{
            background: 'var(--bg-midnight)',
            border: '1px solid var(--graphite-border)',
            borderRadius: 16,
            padding: 24,
            maxWidth: 440,
            width: '100%',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)'
          }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: 18, color: '#fff', fontWeight: 'bold' }}>Create Owner Account</h3>
            
            {createError && (
              <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '10px 14px', borderRadius: 8, color: 'var(--danger-red)', fontSize: 13, marginBottom: 16 }}>
                {createError}
              </div>
            )}
            {createSuccess && (
              <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '10px 14px', borderRadius: 8, color: 'var(--success-green)', fontSize: 13, marginBottom: 16 }}>
                {createSuccess}
              </div>
            )}

            <form onSubmit={handleCreateOwnerSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>Owner Name *</label>
                <input
                  type="text"
                  required
                  value={newOwnerName}
                  onChange={(e) => setNewOwnerName(e.target.value)}
                  placeholder="e.g. Rajesh Kumar"
                  style={{ padding: 10, background: '#090d18', border: '1px solid var(--graphite-border)', borderRadius: 8, color: '#fff', fontSize: 14 }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>Company Name</label>
                <input
                  type="text"
                  value={newCompanyName}
                  onChange={(e) => setNewCompanyName(e.target.value)}
                  placeholder="e.g. Skyline Outdoor Media"
                  style={{ padding: 10, background: '#090d18', border: '1px solid var(--graphite-border)', borderRadius: 8, color: '#fff', fontSize: 14 }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>Owner Email ID *</label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="e.g. rajesh@skylinemedia.com"
                  style={{ padding: 10, background: '#090d18', border: '1px solid var(--graphite-border)', borderRadius: 8, color: '#fff', fontSize: 14 }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>Password *</label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  style={{ padding: 10, background: '#090d18', border: '1px solid var(--graphite-border)', borderRadius: 8, color: '#fff', fontSize: 14 }}
                />
              </div>

              <div style={{ display: 'flex', justifycontent: 'flex-end', gap: 12, marginTop: 12 }}>
                <button
                  type="button"
                  onClick={() => { setShowCreateModal(false); setCreateError(''); }}
                  style={{ padding: '8px 16px', background: 'transparent', border: '1px solid var(--graphite-border)', color: 'var(--text-muted)', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  style={{
                    padding: '8px 20px',
                    background: 'linear-gradient(135deg, #8b5cf6, #ef4444)',
                    border: 'none',
                    color: '#fff',
                    borderRadius: 8,
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: 600
                  }}
                >
                  {isCreating ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {mobileSidebarOpen && <div className="brand-sidebar-backdrop" onClick={() => setMobileSidebarOpen(false)}></div>}
    </div>
  );
}

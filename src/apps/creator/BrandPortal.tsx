// ============================================================================
// BRAND PORTAL
// ============================================================================
// Advertiser/brand side of the creator marketplace:
// - Create campaigns
// - Search & filter creators
// - Smart creator matching
// - Content review & approval workflow
// - Campaign analytics
// ============================================================================

import React, { useState, useMemo } from 'react';
import {
  Plus, Search, Users, DollarSign, BarChart3,
  CheckCircle, Eye,
  TrendingUp,
  Briefcase
} from 'lucide-react';
import type { Brand, Campaign, Creator } from '@/shared/types';
import { formatCurrency, formatDate, getStatusColor } from '@/shared/utils';

type BrandTab = 'overview' | 'creators' | 'campaigns' | 'analytics';

interface BrandPortalProps {
  brand: Brand;
  creators: Creator[];
  campaigns: Campaign[];
  onCreateCampaign: (campaign: Campaign) => void;
  onApproveApplication: (campaignId: string, applicationId: string) => void;
  onRejectApplication: (campaignId: string, applicationId: string) => void;
  onApproveContent: (campaignId: string, submissionId: string) => void;
  onRejectContent: (campaignId: string, submissionId: string, feedback: string) => void;
}

export const BrandPortal: React.FC<BrandPortalProps> = ({
  brand,
  creators,
  campaigns,
  onCreateCampaign,
  onApproveApplication,
  onRejectApplication,
  onApproveContent,
  onRejectContent,
}) => {
  const [activeTab, setActiveTab] = useState<BrandTab>('overview');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creatorSearch, setCreatorSearch] = useState('');
  const [creatorFilter, setCreatorFilter] = useState({ niche: 'all', platform: 'all', minFollowers: 0 });
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);

  const brandCampaigns = campaigns.filter(c => c.brandId === brand.id);
  const activeCampaigns = brandCampaigns.filter(c => c.status === 'open' || c.status === 'in-progress');
  const completedCampaigns = brandCampaigns.filter(c => c.status === 'completed');

  const filteredCreators = useMemo(() => {
    let result = [...creators];
    if (creatorSearch) {
      const q = creatorSearch.toLowerCase();
      result = result.filter(c =>
        c.displayName.toLowerCase().includes(q) ||
        c.handle.toLowerCase().includes(q) ||
        c.niches.some(n => n.toLowerCase().includes(q))
      );
    }
    if (creatorFilter.niche !== 'all') {
      result = result.filter(c => c.niches.includes(creatorFilter.niche));
    }
    if (creatorFilter.platform !== 'all') {
      result = result.filter(c => c.platforms.some(p => p.platform === creatorFilter.platform));
    }
    if (creatorFilter.minFollowers > 0) {
      result = result.filter(c => c.platforms.some(p => p.followers >= creatorFilter.minFollowers));
    }
    return result.sort((a, b) => b.score - a.score);
  }, [creators, creatorSearch, creatorFilter]);

  const allNiches = [...new Set(creators.flatMap(c => c.niches))];
  const allPlatforms = ['instagram', 'tiktok', 'youtube', 'x', 'facebook'];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0B0B0B' }}>
      {/* Sidebar */}
      <div style={{
        width: '260px',
        background: '#111111',
        borderRight: '1px solid #1A1A1A',
        padding: '24px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}>
        <div style={{ padding: '0 8px 20px', borderBottom: '1px solid #1A1A1A', marginBottom: '8px' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            background: '#1F3B73',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '12px',
          }}>
            <Briefcase size={24} color="#FFFFFF" />
          </div>
          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#FFFFFF' }}>{brand.companyName}</h3>
          <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#6B7280' }}>{brand.industry}</p>
        </div>

        {[
          { id: 'overview' as BrandTab, label: 'Overview', icon: <BarChart3 size={16} /> },
          { id: 'creators' as BrandTab, label: 'Find Creators', icon: <Search size={16} /> },
          { id: 'campaigns' as BrandTab, label: 'My Campaigns', icon: <Briefcase size={16} /> },
          { id: 'analytics' as BrandTab, label: 'Analytics', icon: <TrendingUp size={16} /> },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 12px',
              borderRadius: '8px',
              background: activeTab === tab.id ? '#1F3B73' : 'transparent',
              color: activeTab === tab.id ? '#FFFFFF' : '#9CA3AF',
              border: 'none',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 500,
              textAlign: 'left',
            }}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, padding: '24px', overflow: 'auto' }}>
        {activeTab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: '#FFFFFF' }}>Brand Dashboard</h1>
              <button
                onClick={() => setShowCreateModal(true)}
                style={{
                  padding: '10px 18px',
                  background: '#1F3B73',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#FFFFFF',
                  fontSize: '14px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontWeight: 600,
                }}
              >
                <Plus size={16} /> New Campaign
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
              <StatCard title="Active Campaigns" value={activeCampaigns.length} icon={<Briefcase size={18} />} color="#60A5FA" />
              <StatCard title="Total Spent" value={formatCurrency(brandCampaigns.reduce((sum, c) => sum + c.budget, 0), brand.budgetRange?.currency || 'USD')} icon={<DollarSign size={18} />} color="#4ADE80" />
              <StatCard title="Creators Hired" value={brandCampaigns.reduce((sum, c) => sum + c.selectedCreators.length, 0)} icon={<Users size={18} />} color="#A78BFA" />
              <StatCard title="Completed" value={completedCampaigns.length} icon={<CheckCircle size={18} />} color="#FACC15" />
            </div>

            {/* Recent Activity */}
            <div style={{ background: '#181818', border: '1px solid #222', borderRadius: '12px', padding: '20px' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: '14px', fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase' }}>Recent Applications</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {brandCampaigns.flatMap(c => c.applications).slice(0, 5).map(app => (
                  <div key={app.id} style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px',
                    background: '#141414',
                    borderRadius: '8px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        background: '#1F3B73',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '14px',
                        fontWeight: 700,
                        color: '#FFFFFF',
                      }}>
                        {app.creatorName?.charAt(0)}
                      </div>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 500, color: '#FFFFFF' }}>{app.creatorName}</div>
                        <div style={{ fontSize: '12px', color: '#6B7280' }}>
                          {campaigns.find(c => c.id === app.campaignId)?.title} · {formatCurrency(app.proposedRate, 'USD')}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        onClick={() => onApproveApplication(app.campaignId, app.id)}
                        style={{
                          padding: '6px 12px',
                          background: '#0A3D1F',
                          border: '1px solid #166534',
                          borderRadius: '6px',
                          color: '#4ADE80',
                          fontSize: '12px',
                          cursor: 'pointer',
                        }}
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => onRejectApplication(app.campaignId, app.id)}
                        style={{
                          padding: '6px 12px',
                          background: '#450A0A',
                          border: '1px solid #991B1B',
                          borderRadius: '6px',
                          color: '#F87171',
                          fontSize: '12px',
                          cursor: 'pointer',
                        }}
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
                {brandCampaigns.flatMap(c => c.applications).length === 0 && (
                  <div style={{ textAlign: 'center', padding: '24px', color: '#6B7280' }}>
                    No applications yet
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'creators' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: '#FFFFFF' }}>Find Creators</h1>

            {/* Filters */}
            <div style={{
              display: 'flex',
              gap: '12px',
              flexWrap: 'wrap',
              padding: '16px',
              background: '#181818',
              border: '1px solid #222',
              borderRadius: '12px',
            }}>
              <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
                <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#6B7280' }} />
                <input
                  type="text"
                  placeholder="Search creators..."
                  value={creatorSearch}
                  onChange={e => setCreatorSearch(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px 10px 36px',
                    background: '#1A1A1A',
                    border: '1px solid #2C2C2C',
                    borderRadius: '8px',
                    color: '#FFFFFF',
                    fontSize: '14px',
                    outline: 'none',
                  }}
                />
              </div>
              <select
                value={creatorFilter.niche}
                onChange={e => setCreatorFilter({ ...creatorFilter, niche: e.target.value })}
                style={{
                  padding: '10px 12px',
                  background: '#1A1A1A',
                  border: '1px solid #2C2C2C',
                  borderRadius: '8px',
                  color: '#FFFFFF',
                  fontSize: '14px',
                  cursor: 'pointer',
                }}
              >
                <option value="all">All Niches</option>
                {allNiches.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
              <select
                value={creatorFilter.platform}
                onChange={e => setCreatorFilter({ ...creatorFilter, platform: e.target.value })}
                style={{
                  padding: '10px 12px',
                  background: '#1A1A1A',
                  border: '1px solid #2C2C2C',
                  borderRadius: '8px',
                  color: '#FFFFFF',
                  fontSize: '14px',
                  cursor: 'pointer',
                }}
              >
                <option value="all">All Platforms</option>
                {allPlatforms.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <select
                value={creatorFilter.minFollowers}
                onChange={e => setCreatorFilter({ ...creatorFilter, minFollowers: Number(e.target.value) })}
                style={{
                  padding: '10px 12px',
                  background: '#1A1A1A',
                  border: '1px solid #2C2C2C',
                  borderRadius: '8px',
                  color: '#FFFFFF',
                  fontSize: '14px',
                  cursor: 'pointer',
                }}
              >
                <option value={0}>Any Followers</option>
                <option value={1000}>1K+</option>
                <option value={10000}>10K+</option>
                <option value={50000}>50K+</option>
                <option value={100000}>100K+</option>
                <option value={500000}>500K+</option>
                <option value={1000000}>1M+</option>
              </select>
            </div>

            <p style={{ fontSize: '13px', color: '#6B7280' }}>{filteredCreators.length} creators found</p>

            {/* Creator Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
              {filteredCreators.map(creator => (
                <div key={creator.id} style={{
                  background: '#181818',
                  border: '1px solid #222',
                  borderRadius: '12px',
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '50%',
                      background: '#1F3B73',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '18px',
                      fontWeight: 700,
                      color: '#FFFFFF',
                    }}>
                      {creator.displayName.charAt(0)}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '15px', fontWeight: 600, color: '#FFFFFF' }}>{creator.displayName}</div>
                      <div style={{ fontSize: '12px', color: '#6B7280' }}>@{creator.handle}</div>
                    </div>
                    <div style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      background: creator.score >= 80 ? '#0A3D1F' : '#422006',
                      color: creator.score >= 80 ? '#4ADE80' : '#FACC15',
                      fontSize: '12px',
                      fontWeight: 700,
                    }}>
                      {creator.score}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {creator.niches.slice(0, 3).map(niche => (
                      <span key={niche} style={{ padding: '2px 8px', borderRadius: '4px', background: '#1A1A1A', fontSize: '11px', color: '#9CA3AF' }}>{niche}</span>
                    ))}
                  </div>

                  <div style={{ display: 'flex', gap: '12px' }}>
                    {creator.platforms.slice(0, 3).map(p => (
                      <div key={p.platform} style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '12px', color: '#6B7280', textTransform: 'capitalize' }}>{p.platform}</div>
                        <div style={{ fontSize: '14px', fontWeight: 600, color: '#FFFFFF' }}>{p.followers >= 1000 ? `${(p.followers / 1000).toFixed(1)}K` : p.followers}</div>
                        <div style={{ fontSize: '11px', color: '#4ADE80' }}>{p.engagementRate}% ER</div>
                      </div>
                    ))}
                  </div>

                  {creator.pricing && (
                    <div style={{ fontSize: '13px', color: '#FACC15' }}>
                      From {formatCurrency(creator.pricing.postRate, creator.pricing.currency)}/post
                    </div>
                  )}

                  <button style={{
                    width: '100%',
                    padding: '10px',
                    background: '#1F3B73',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#FFFFFF',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}>
                    Invite to Campaign
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'campaigns' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: '#FFFFFF' }}>My Campaigns</h1>
              <button
                onClick={() => setShowCreateModal(true)}
                style={{
                  padding: '10px 18px',
                  background: '#1F3B73',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#FFFFFF',
                  fontSize: '14px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <Plus size={16} /> New Campaign
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {brandCampaigns.map(campaign => (
                <div key={campaign.id} style={{
                  background: '#181818',
                  border: '1px solid #222',
                  borderRadius: '12px',
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#FFFFFF' }}>{campaign.title}</h3>
                      <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#6B7280' }}>{campaign.description.slice(0, 80)}...</p>
                    </div>
                    <StatusBadge status={campaign.status} />
                  </div>

                  <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '13px', color: '#FACC15' }}>{formatCurrency(campaign.budget, campaign.currency)} budget</span>
                    <span style={{ fontSize: '13px', color: '#B3B3B3' }}>{campaign.applications.length} applications</span>
                    <span style={{ fontSize: '13px', color: '#B3B3B3' }}>{campaign.selectedCreators.length} hired</span>
                    <span style={{ fontSize: '13px', color: '#B3B3B3' }}>Deadline: {formatDate(campaign.deadline)}</span>
                  </div>

                  {/* Content Submissions */}
                  {campaign.contentSubmissions.length > 0 && (
                    <div style={{
                      padding: '12px',
                      background: '#141414',
                      borderRadius: '8px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}>
                      <span style={{ fontSize: '12px', color: '#9CA3AF', textTransform: 'uppercase' }}>Pending Content Review</span>
                      {campaign.contentSubmissions.filter(s => s.status === 'submitted').map(sub => (
                        <div key={sub.id} style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px',
                          background: '#1A1A1A',
                          borderRadius: '6px',
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Eye size={14} color="#60A5FA" />
                            <span style={{ fontSize: '13px', color: '#FFFFFF' }}>{sub.type} submission</span>
                          </div>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                              onClick={() => onApproveContent(campaign.id, sub.id)}
                              style={{
                                padding: '4px 10px',
                                background: '#0A3D1F',
                                border: '1px solid #166534',
                                borderRadius: '4px',
                                color: '#4ADE80',
                                fontSize: '11px',
                                cursor: 'pointer',
                              }}
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => onRejectContent(campaign.id, sub.id, 'Does not match brand guidelines')}
                              style={{
                                padding: '4px 10px',
                                background: '#450A0A',
                                border: '1px solid #991B1B',
                                borderRadius: '4px',
                                color: '#F87171',
                                fontSize: '11px',
                                cursor: 'pointer',
                              }}
                            >
                              Reject
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {brandCampaigns.length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px', color: '#6B7280' }}>
                  <Briefcase size={32} style={{ marginBottom: '8px' }} />
                  <p>No campaigns yet. Create your first campaign to get started.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Create Campaign Modal */}
      {showCreateModal && (
        <CreateCampaignModal
          brand={brand}
          onClose={() => setShowCreateModal(false)}
          onCreate={onCreateCampaign}
        />
      )}
    </div>
  );
};

const CreateCampaignModal: React.FC<{
  brand: Brand;
  onClose: () => void;
  onCreate: (campaign: Campaign) => void;
}> = ({ brand, onClose, onCreate }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [requirements, setRequirements] = useState('');
  const [budget, setBudget] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [deadline, setDeadline] = useState('');
  const [selectedNiches, setSelectedNiches] = useState<string[]>([]);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);

  const niches = ['fashion', 'food', 'tech', 'travel', 'fitness', 'beauty', 'lifestyle', 'gaming', 'finance', 'education'];
  const platforms = ['instagram', 'tiktok', 'youtube', 'x', 'facebook'];

  const toggleNiche = (niche: string) => {
    setSelectedNiches(prev => prev.includes(niche) ? prev.filter(n => n !== niche) : [...prev, niche]);
  };

  const togglePlatform = (platform: string) => {
    setSelectedPlatforms(prev => prev.includes(platform) ? prev.filter(p => p !== platform) : [...prev, platform]);
  };

  const submit = () => {
    const campaign: Campaign = {
      id: `camp-${Date.now()}`,
      brandId: brand.id,
      brandName: brand.companyName,
      title,
      description,
      requirements,
      deliverables: [{ type: 'post', quantity: 1 }],
      budget: Number(budget),
      currency,
      niches: selectedNiches,
      platforms: selectedPlatforms,
      deadline,
      status: 'open',
      applications: [],
      selectedCreators: [],
      contentSubmissions: [],
      createdAt: new Date().toISOString(),
    };
    onCreate(campaign);
    onClose();
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
    }}>
      <div style={{
        background: '#181818',
        border: '1px solid #222',
        borderRadius: '16px',
        padding: '24px',
        width: '100%',
        maxWidth: '600px',
        maxHeight: '90vh',
        overflow: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
      }}>
        <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#FFFFFF' }}>Create New Campaign</h3>
        <InputField label="Campaign Title *" value={title} onChange={setTitle} />
        <div>
          <label style={{ fontSize: '12px', color: '#9CA3AF', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Description</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }} />
        </div>
        <div>
          <label style={{ fontSize: '12px', color: '#9CA3AF', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Requirements</label>
          <textarea value={requirements} onChange={e => setRequirements(e.target.value)} style={{ ...inputStyle, minHeight: '60px', resize: 'vertical' }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <InputField label="Budget *" value={budget} onChange={setBudget} type="number" />
          <div>
            <label style={{ fontSize: '12px', color: '#9CA3AF', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Currency</label>
            <select value={currency} onChange={e => setCurrency(e.target.value)} style={inputStyle}>
              <option value="USD">USD</option>
              <option value="TZS">TZS</option>
              <option value="EUR">EUR</option>
            </select>
          </div>
        </div>
        <InputField label="Deadline *" value={deadline} onChange={setDeadline} type="date" />
        <div>
          <label style={{ fontSize: '12px', color: '#9CA3AF', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Target Niches</label>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {niches.map(niche => (
              <button
                key={niche}
                onClick={() => toggleNiche(niche)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  background: selectedNiches.includes(niche) ? '#1F3B73' : '#1A1A1A',
                  border: `1px solid ${selectedNiches.includes(niche) ? '#1F3B73' : '#2C2C2C'}`,
                  color: selectedNiches.includes(niche) ? '#FFFFFF' : '#B3B3B3',
                  cursor: 'pointer',
                  fontSize: '12px',
                  textTransform: 'capitalize',
                }}
              >
                {niche}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label style={{ fontSize: '12px', color: '#9CA3AF', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Target Platforms</label>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {platforms.map(platform => (
              <button
                key={platform}
                onClick={() => togglePlatform(platform)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  background: selectedPlatforms.includes(platform) ? '#1F3B73' : '#1A1A1A',
                  border: `1px solid ${selectedPlatforms.includes(platform) ? '#1F3B73' : '#2C2C2C'}`,
                  color: selectedPlatforms.includes(platform) ? '#FFFFFF' : '#B3B3B3',
                  cursor: 'pointer',
                  fontSize: '12px',
                  textTransform: 'capitalize',
                }}
              >
                {platform}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
          <button onClick={onClose} style={{ flex: 1, padding: '10px', background: 'transparent', border: '1px solid #2C2C2C', borderRadius: '8px', color: '#B3B3B3', fontSize: '14px', cursor: 'pointer' }}>
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!title || !budget || !deadline}
            style={{
              flex: 1,
              padding: '10px',
              background: !title || !budget || !deadline ? '#1A1A1A' : '#1F3B73',
              border: 'none',
              borderRadius: '8px',
              color: '#FFFFFF',
              fontSize: '14px',
              cursor: !title || !budget || !deadline ? 'not-allowed' : 'pointer',
              fontWeight: 600,
            }}
          >
            Create Campaign
          </button>
        </div>
      </div>
    </div>
  );
};

const StatCard: React.FC<{ title: string; value: string | number; icon: React.ReactNode; color: string }> = ({ title, value, icon, color }) => (
  <div style={{ background: '#181818', border: '1px solid #222', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span style={{ color: '#9CA3AF', fontSize: '13px', fontWeight: 500, textTransform: 'uppercase' }}>{title}</span>
      <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color }}>{icon}</div>
    </div>
    <div style={{ fontSize: '26px', fontWeight: 700, color: '#FFFFFF' }}>{value}</div>
  </div>
);

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const colors = getStatusColor(status);
  return (
    <span style={{
      padding: '3px 10px',
      borderRadius: '6px',
      fontSize: '12px',
      fontWeight: 600,
      background: colors.bg,
      color: colors.text,
      border: `1px solid ${colors.border}`,
      textTransform: 'uppercase',
    }}>
      {status.replace('-', ' ')}
    </span>
  );
};

const InputField: React.FC<{ label: string; value: string; onChange: (val: string) => void; type?: string }> = ({ label, value, onChange, type = 'text' }) => (
  <div>
    <label style={{ fontSize: '12px', color: '#9CA3AF', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>{label}</label>
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        width: '100%',
        padding: '10px 12px',
        background: '#1A1A1A',
        border: '1px solid #2C2C2C',
        borderRadius: '8px',
        color: '#FFFFFF',
        fontSize: '14px',
        outline: 'none',
        boxSizing: 'border-box',
      }}
    />
  </div>
);

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  background: '#1A1A1A',
  border: '1px solid #2C2C2C',
  borderRadius: '8px',
  color: '#FFFFFF',
  fontSize: '14px',
  outline: 'none',
  boxSizing: 'border-box',
};

export default BrandPortal;

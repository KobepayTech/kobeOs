// ============================================================================
// CREATOR DASHBOARD
// ============================================================================
// Creator-side portal with:
// - Earnings, active campaigns, pending approvals
// - Engagement analytics
// - Media kit / public profile
// - Campaign marketplace (browse & apply)
// - Content submission workflow
// ============================================================================

import React, { useState } from 'react';
import {
  DollarSign, TrendingUp, Users, Star, BarChart3, Briefcase,
  CheckCircle, Clock, MessageSquare, Globe, Instagram, Youtube,
  Music as Tiktok, Twitter, Edit3, Share2, Eye, ChevronRight, Filter,
  Search, Plus, Image, Video, FileText, Send
} from 'lucide-react';
import type { Creator, Campaign, CampaignApplication, ContentSubmission } from '@/shared/types';
import { formatCurrency, formatDate, getStatusColor } from '@/shared/utils';

type CreatorTab = 'overview' | 'campaigns' | 'analytics' | 'portfolio' | 'inbox';

interface CreatorDashboardProps {
  creator: Creator;
  campaigns: Campaign[];
  onApplyCampaign: (application: CampaignApplication) => void;
  onSubmitContent: (submission: ContentSubmission) => void;
  onUpdateProfile: (creator: Creator) => void;
}

export const CreatorDashboard: React.FC<CreatorDashboardProps> = ({
  creator,
  campaigns,
  onApplyCampaign,
  onSubmitContent,
  onUpdateProfile,
}) => {
  const [activeTab, setActiveTab] = useState<CreatorTab>('overview');
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [applyMessage, setApplyMessage] = useState('');
  const [proposedRate, setProposedRate] = useState('');
  const [showApplyModal, setShowApplyModal] = useState(false);

  const tabs: { id: CreatorTab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Overview', icon: <BarChart3 size={16} /> },
    { id: 'campaigns', label: 'Campaigns', icon: <Briefcase size={16} /> },
    { id: 'analytics', label: 'Analytics', icon: <TrendingUp size={16} /> },
    { id: 'portfolio', label: 'Portfolio', icon: <Image size={16} /> },
    { id: 'inbox', label: 'Inbox', icon: <MessageSquare size={16} /> },
  ];

  const openCampaigns = campaigns.filter(c => c.status === 'open');
  const myApplications = campaigns.flatMap(c => c.applications.filter(a => a.creatorId === creator.id));
  const mySubmissions = campaigns.flatMap(c => c.contentSubmissions.filter(s => s.creatorId === creator.id));

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
        {/* Profile Summary */}
        <div style={{ padding: '0 8px 20px', borderBottom: '1px solid #1A1A1A', marginBottom: '8px' }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: '#1F3B73',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '20px',
            fontWeight: 700,
            color: '#FFFFFF',
            marginBottom: '12px',
          }}>
            {creator.displayName.charAt(0)}
          </div>
          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#FFFFFF' }}>{creator.displayName}</h3>
          <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#6B7280' }}>@{creator.handle}</p>
          <div style={{ display: 'flex', gap: '4px', marginTop: '8px', flexWrap: 'wrap' }}>
            {creator.niches.map(niche => (
              <span key={niche} style={{
                padding: '2px 8px',
                borderRadius: '4px',
                background: '#1A1A1A',
                fontSize: '11px',
                color: '#9CA3AF',
              }}>
                {niche}
              </span>
            ))}
          </div>
        </div>

        {/* Navigation */}
        {tabs.map(tab => (
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

        {/* Public Profile Link */}
        <div style={{ marginTop: 'auto', padding: '16px 8px 0', borderTop: '1px solid #1A1A1A' }}>
          <a
            href={`https://creators.kobe/@${creator.handle}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 12px',
              background: '#1A1A1A',
              borderRadius: '8px',
              color: '#60A5FA',
              fontSize: '13px',
              textDecoration: 'none',
            }}
          >
            <Globe size={14} /> View Public Profile
          </a>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, padding: '24px', overflow: 'auto' }}>
        {activeTab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: '#FFFFFF' }}>Creator Dashboard</h1>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
              <StatCard title="Total Earnings" value={formatCurrency(creator.analytics.totalEarnings, 'USD')} icon={<DollarSign size={18} />} color="#4ADE80" trend="+12%" />
              <StatCard title="Active Campaigns" value={creator.analytics.activeCampaigns} icon={<Briefcase size={18} />} color="#60A5FA" />
              <StatCard title="Pending Approvals" value={creator.analytics.pendingApprovals} icon={<Clock size={18} />} color="#FACC15" />
              <StatCard title="Completed" value={creator.analytics.completedCampaigns} icon={<CheckCircle size={18} />} color="#A78BFA" />
              <StatCard title="Engagement Rate" value={`${creator.analytics.avgEngagementRate}%`} icon={<TrendingUp size={18} />} color="#F87171" />
              <StatCard title="Audience Growth" value={`+${creator.analytics.audienceGrowth}%`} icon={<Users size={18} />} color="#4ADE80" />
            </div>

            {/* Platform Breakdown */}
            <div style={{ background: '#181818', border: '1px solid #222', borderRadius: '12px', padding: '20px' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: '14px', fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Platform Breakdown
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {creator.platforms.map(platform => (
                  <div key={platform.platform} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '10px',
                      background: '#1A1A1A',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#FFFFFF',
                    }}>
                      {platform.platform === 'instagram' && <Instagram size={18} />}
                      {platform.platform === 'tiktok' && <Tiktok size={18} />}
                      {platform.platform === 'youtube' && <Youtube size={18} />}
                      {platform.platform === 'x' && <Twitter size={18} />}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '14px', fontWeight: 600, color: '#FFFFFF', textTransform: 'capitalize' }}>{platform.platform}</span>
                        <span style={{ fontSize: '13px', color: '#B3B3B3' }}>{platform.followers.toLocaleString()} followers</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px' }}>
                        <span style={{ fontSize: '12px', color: '#9CA3AF' }}>ER: {platform.engagementRate}%</span>
                        <span style={{ fontSize: '12px', color: '#9CA3AF' }}>Growth: +{platform.growthRate}%</span>
                        <span style={{ fontSize: '12px', color: '#9CA3AF' }}>Posts: {platform.postingFrequency}/week</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Actions */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
              <QuickActionCard
                title="Browse Campaigns"
                description={`${openCampaigns.length} open campaigns available`}
                icon={<Briefcase size={24} />}
                color="#60A5FA"
                onClick={() => setActiveTab('campaigns')}
              />
              <QuickActionCard
                title="Update Media Kit"
                description="Keep your profile and pricing current"
                icon={<Edit3 size={24} />}
                color="#FACC15"
                onClick={() => onUpdateProfile(creator)}
              />
              <QuickActionCard
                title="Submit Content"
                description={`${mySubmissions.filter(s => s.status === 'draft').length} drafts pending`}
                icon={<Send size={24} />}
                color="#4ADE80"
                onClick={() => setActiveTab('campaigns')}
              />
            </div>
          </div>
        )}

        {activeTab === 'campaigns' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: '#FFFFFF' }}>Campaign Marketplace</h1>

            {/* My Applications */}
            {myApplications.length > 0 && (
              <div style={{ background: '#181818', border: '1px solid #222', borderRadius: '12px', padding: '20px' }}>
                <h3 style={{ margin: '0 0 16px', fontSize: '14px', fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase' }}>My Applications</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {myApplications.map(app => (
                    <div key={app.id} style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px',
                      background: '#141414',
                      borderRadius: '8px',
                    }}>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 600, color: '#FFFFFF' }}>
                          {campaigns.find(c => c.id === app.campaignId)?.title}
                        </div>
                        <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '2px' }}>
                          Proposed: {formatCurrency(app.proposedRate, 'USD')} · {formatDate(app.appliedAt)}
                        </div>
                      </div>
                      <StatusBadge status={app.status} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Available Campaigns */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase' }}>Available Campaigns</h3>
              {openCampaigns.map(campaign => (
                <div key={campaign.id} style={{
                  background: '#181818',
                  border: '1px solid #222',
                  borderRadius: '12px',
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#FFFFFF' }}>{campaign.title}</h3>
                      <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#6B7280' }}>{campaign.brandName}</p>
                    </div>
                    <span style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 600,
                      background: '#0A3D1F',
                      color: '#4ADE80',
                      border: '1px solid #166534',
                    }}>
                      {formatCurrency(campaign.budget, campaign.currency)}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: '13px', color: '#B3B3B3', lineHeight: 1.5 }}>{campaign.description}</p>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {campaign.niches.map(niche => (
                      <span key={niche} style={{ padding: '2px 8px', borderRadius: '4px', background: '#1A1A1A', fontSize: '11px', color: '#9CA3AF' }}>{niche}</span>
                    ))}
                    {campaign.platforms.map(p => (
                      <span key={p} style={{ padding: '2px 8px', borderRadius: '4px', background: '#1E3A5F', fontSize: '11px', color: '#60A5FA', textTransform: 'capitalize' }}>{p}</span>
                    ))}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px' }}>
                    <span style={{ fontSize: '12px', color: '#6B7280' }}>Deadline: {formatDate(campaign.deadline)}</span>
                    <button
                      onClick={() => { setSelectedCampaign(campaign); setShowApplyModal(true); }}
                      style={{
                        padding: '8px 16px',
                        background: '#1F3B73',
                        border: 'none',
                        borderRadius: '8px',
                        color: '#FFFFFF',
                        fontSize: '13px',
                        cursor: 'pointer',
                        fontWeight: 600,
                      }}
                    >
                      Apply Now
                    </button>
                  </div>
                </div>
              ))}
              {openCampaigns.length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px', color: '#6B7280' }}>
                  <Briefcase size={32} style={{ marginBottom: '8px' }} />
                  <p>No open campaigns at the moment</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'analytics' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: '#FFFFFF' }}>Analytics</h1>
            <div style={{ background: '#181818', border: '1px solid #222', borderRadius: '12px', padding: '20px' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: '14px', fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase' }}>Monthly Performance</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {creator.analytics.monthlyStats.map(stat => (
                  <div key={stat.month} style={{
                    display: 'grid',
                    gridTemplateColumns: '100px 1fr 1fr 1fr 1fr',
                    gap: '12px',
                    padding: '10px',
                    background: '#141414',
                    borderRadius: '8px',
                    fontSize: '13px',
                  }}>
                    <span style={{ color: '#FFFFFF', fontWeight: 600 }}>{stat.month}</span>
                    <span style={{ color: '#4ADE80' }}>{formatCurrency(stat.earnings, 'USD')}</span>
                    <span style={{ color: '#B3B3B3' }}>{stat.campaigns} campaigns</span>
                    <span style={{ color: '#60A5FA' }}>{stat.engagement}% ER</span>
                    <span style={{ color: '#9CA3AF' }}>{stat.followers.toLocaleString()} followers</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'portfolio' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: '#FFFFFF' }}>Portfolio</h1>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
              {creator.portfolio.map(item => (
                <div key={item.id} style={{
                  background: '#181818',
                  border: '1px solid #222',
                  borderRadius: '12px',
                  overflow: 'hidden',
                }}>
                  <div style={{
                    height: '160px',
                    background: '#1A1A1A',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#6B7280',
                  }}>
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <Image size={32} />
                    )}
                  </div>
                  <div style={{ padding: '14px' }}>
                    <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#FFFFFF' }}>{item.title}</h4>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                      <span style={{ fontSize: '12px', color: '#9CA3AF', textTransform: 'capitalize' }}>{item.platform}</span>
                      <span style={{ fontSize: '12px', color: '#6B7280' }}>·</span>
                      <span style={{ fontSize: '12px', color: '#9CA3AF' }}>{formatDate(item.date)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Apply Modal */}
      {showApplyModal && selectedCampaign && (
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
            maxWidth: '500px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#FFFFFF' }}>Apply to Campaign</h3>
            <p style={{ margin: 0, fontSize: '14px', color: '#B3B3B3' }}>{selectedCampaign.title}</p>
            <div>
              <label style={{ fontSize: '12px', color: '#9CA3AF', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Your Rate (USD)</label>
              <input
                type="number"
                value={proposedRate}
                onChange={e => setProposedRate(e.target.value)}
                placeholder="Enter your proposed rate"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  background: '#1A1A1A',
                  border: '1px solid #2C2C2C',
                  borderRadius: '8px',
                  color: '#FFFFFF',
                  fontSize: '14px',
                  outline: 'none',
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: '12px', color: '#9CA3AF', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Message to Brand</label>
              <textarea
                value={applyMessage}
                onChange={e => setApplyMessage(e.target.value)}
                placeholder="Why are you a good fit?"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  background: '#1A1A1A',
                  border: '1px solid #2C2C2C',
                  borderRadius: '8px',
                  color: '#FFFFFF',
                  fontSize: '14px',
                  outline: 'none',
                  minHeight: '80px',
                  resize: 'vertical',
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
              <button
                onClick={() => setShowApplyModal(false)}
                style={{
                  flex: 1,
                  padding: '10px',
                  background: 'transparent',
                  border: '1px solid #2C2C2C',
                  borderRadius: '8px',
                  color: '#B3B3B3',
                  fontSize: '14px',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const application: CampaignApplication = {
                    id: `app-${Date.now()}`,
                    campaignId: selectedCampaign.id,
                    creatorId: creator.id,
                    creatorName: creator.displayName,
                    message: applyMessage,
                    proposedRate: Number(proposedRate),
                    status: 'pending',
                    appliedAt: new Date().toISOString(),
                  };
                  onApplyCampaign(application);
                  setShowApplyModal(false);
                  setApplyMessage('');
                  setProposedRate('');
                }}
                disabled={!proposedRate}
                style={{
                  flex: 1,
                  padding: '10px',
                  background: !proposedRate ? '#1A1A1A' : '#1F3B73',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#FFFFFF',
                  fontSize: '14px',
                  cursor: !proposedRate ? 'not-allowed' : 'pointer',
                  fontWeight: 600,
                }}
              >
                Submit Application
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const StatCard: React.FC<{ title: string; value: string | number; icon: React.ReactNode; color: string; trend?: string }> = ({ title, value, icon, color, trend }) => (
  <div style={{ background: '#181818', border: '1px solid #222', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span style={{ color: '#9CA3AF', fontSize: '13px', fontWeight: 500, textTransform: 'uppercase' }}>{title}</span>
      <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color }}>{icon}</div>
    </div>
    <div style={{ fontSize: '26px', fontWeight: 700, color: '#FFFFFF' }}>{value}</div>
    {trend && <div style={{ fontSize: '12px', color: '#4ADE80' }}>{trend}</div>}
  </div>
);

const QuickActionCard: React.FC<{ title: string; description: string; icon: React.ReactNode; color: string; onClick: () => void }> = ({ title, description, icon, color, onClick }) => (
  <button
    onClick={onClick}
    style={{
      background: '#181818',
      border: '1px solid #222',
      borderRadius: '12px',
      padding: '24px',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      cursor: 'pointer',
      textAlign: 'left',
      color: 'inherit',
      transition: 'all 0.15s',
    }}
    onMouseEnter={e => { e.currentTarget.style.borderColor = color; e.currentTarget.style.background = '#1A1A1A'; }}
    onMouseLeave={e => { e.currentTarget.style.borderColor = '#222'; e.currentTarget.style.background = '#181818'; }}
  >
    <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color }}>
      {icon}
    </div>
    <div>
      <div style={{ fontSize: '16px', fontWeight: 600, color: '#FFFFFF' }}>{title}</div>
      <div style={{ fontSize: '13px', color: '#6B7280', marginTop: '4px' }}>{description}</div>
    </div>
  </button>
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
      {status}
    </span>
  );
};

export default CreatorDashboard;

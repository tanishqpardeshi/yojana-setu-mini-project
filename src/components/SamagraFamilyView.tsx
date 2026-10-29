import React, { useState } from 'react';
import { 
  Users, 
  Search, 
  CheckCircle, 
  AlertCircle, 
  UserCheck, 
  CreditCard, 
  Sparkles, 
  ArrowRight,
  ShieldCheck,
  Building,
  Layers
} from 'lucide-react';
import { SamagraFamily, FamilyMember, SupportedLanguage, CitizenProfile, Scheme } from '../types';
import { MOCK_SAMAGRA_FAMILIES } from '../data/samagraMockProfiles';
import { rankSchemesForCitizen } from '../utils/rulesEngine';

interface SamagraFamilyViewProps {
  currentLanguage: SupportedLanguage;
  schemes: Scheme[];
  onSelectMemberForProfile: (member: FamilyMember, family: SamagraFamily) => void;
}

export const SamagraFamilyView: React.FC<SamagraFamilyViewProps> = ({
  currentLanguage,
  schemes,
  onSelectMemberForProfile,
}) => {
  const [searchId, setSearchId] = useState('48921840');
  const [selectedFamily, setSelectedFamily] = useState<SamagraFamily>(MOCK_SAMAGRA_FAMILIES[0]);
  const [selectedMember, setSelectedMember] = useState<FamilyMember>(MOCK_SAMAGRA_FAMILIES[0].members[1]); // Default to Sunita Sharma (Ladli Behna beneficiary)
  const [searchError, setSearchError] = useState<string | null>(null);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchError(null);
    const cleaned = searchId.trim();

    // Check if matching family ID or member ID
    const foundByFamily = MOCK_SAMAGRA_FAMILIES.find(f => f.familyId === cleaned);
    if (foundByFamily) {
      setSelectedFamily(foundByFamily);
      setSelectedMember(foundByFamily.members[0]);
      return;
    }

    const foundByMember = MOCK_SAMAGRA_FAMILIES.find(f => f.members.some(m => m.memberId === cleaned));
    if (foundByMember) {
      setSelectedFamily(foundByMember);
      const m = foundByMember.members.find(x => x.memberId === cleaned)!;
      setSelectedMember(m);
      return;
    }

    setSearchError(`Samagra ID "${cleaned}" not found in local cache. Try pre-loaded IDs: 48921840 (Sharma), 71203945 (Patel Farmer), 39510482 (Verma), or 84019283 (Bhil).`);
  };

  const handleSelectPreset = (family: SamagraFamily) => {
    setSelectedFamily(family);
    setSearchId(family.familyId);
    setSelectedMember(family.members[0]);
    setSearchError(null);
  };

  // Convert selected family member into a virtual CitizenProfile to run real-time rules
  const memberProfile: CitizenProfile = {
    fullName: selectedMember.name,
    age: selectedMember.age,
    gender: selectedMember.gender,
    category: selectedFamily.familyId === '84019283' ? 'ST' : selectedFamily.familyId === '71203945' ? 'OBC' : 'GEN',
    areaType: selectedFamily.areaType,
    wardNumber: selectedFamily.areaType === 'urban' ? 72 : undefined,
    blockName: selectedFamily.areaType === 'rural' ? (selectedFamily.wardOrBlock.includes('Depalpur') ? 'Depalpur' : 'Mhow') : undefined,
    annualIncome: selectedMember.annualIncome || (selectedFamily.rationCardType === 'BPL' ? 120000 : 250000),
    occupation: selectedMember.occupation,
    landHoldingHectares: selectedMember.occupation === 'Farmer' ? 1.8 : 0,
    isBPL: selectedFamily.rationCardType === 'BPL' || selectedFamily.rationCardType === 'Antyodaya',
    hasDisability: false,
    maritalStatus: selectedMember.maritalStatus || 'Married',
    isMpDomicile: true,
    isIndoreResident: true,
    samagraFamilyId: selectedFamily.familyId,
    samagraMemberId: selectedMember.memberId,
    verifiedDocuments: {
      samagra_family: { verified: true, source: 'mp_edistrict' },
      samagra_member: { verified: selectedMember.ekycStatus, source: 'mp_edistrict' },
      aadhaar: { verified: selectedMember.ekycStatus, source: 'digilocker' },
      bank_dbt: { verified: selectedMember.dbtActive, source: 'digilocker' },
      mp_domicile: { verified: true, source: 'digilocker' },
      khasra_b1: { verified: selectedMember.occupation === 'Farmer', source: 'mp_edistrict' },
    },
  };

  const memberEligibilityResults = rankSchemesForCitizen(memberProfile, schemes);
  const eligibleSchemes = memberEligibilityResults.filter(r => r.status === 'eligible');
  const likelySchemes = memberEligibilityResults.filter(r => r.status === 'likely');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Title */}
      <div>
        <div className="flex items-center space-x-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider bg-emerald-100 px-2 py-0.5 rounded">
            MP State Social Security & SPR Portal Sync
          </span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-1 font-heading">
          {currentLanguage === 'hi'
            ? 'समग्र परिवार एवं सदस्य अधिकार प्रोफाइल'
            : currentLanguage === 'malwi'
            ? 'समग्र कुटुंब खाता व हकदारी'
            : 'Samagra Family & Member Entitlement Profile'}
        </h2>
        <p className="text-sm text-slate-500">
          Enter an 8-digit Samagra Family ID or 9-digit Member ID to map welfare entitlements for all family members in Indore.
        </p>
      </div>

      {/* Search Bar & Preset Pickers */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4 text-emerald-600" />
            </div>
            <input
              type="text"
              value={searchId}
              onChange={e => setSearchId(e.target.value)}
              placeholder="Enter 8-digit Family ID (e.g. 48921840) or 9-digit Member ID..."
              className="w-full pl-10 pr-3 py-2.5 text-sm rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-mono text-slate-900"
            />
          </div>
          <button
            type="submit"
            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs transition"
          >
            Fetch Samagra Profile
          </button>
        </form>

        {searchError && (
          <div className="text-xs text-rose-700 bg-rose-50 p-2.5 rounded-xl border border-rose-200">
            {searchError}
          </div>
        )}

        {/* Quick Sample Presets */}
        <div className="pt-2 border-t border-slate-100 flex items-center flex-wrap gap-2 text-xs">
          <span className="text-slate-500 font-semibold flex items-center">
            <Sparkles className="w-3.5 h-3.5 text-amber-500 mr-1" />
            Try verified Indore families:
          </span>
          {MOCK_SAMAGRA_FAMILIES.map(fam => (
            <button
              key={fam.familyId}
              onClick={() => handleSelectPreset(fam)}
              className={`px-3 py-1 rounded-xl text-xs font-semibold border transition ${
                selectedFamily.familyId === fam.familyId
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              {fam.headName} ({fam.areaType === 'urban' ? 'Urban Ward' : 'Rural Janpad'})
            </button>
          ))}
        </div>
      </div>

      {/* Main Family Overview Banner */}
      <div className="bg-gradient-to-r from-emerald-900 via-slate-900 to-teal-950 text-white rounded-3xl p-6 shadow-xl">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="bg-emerald-500/20 text-emerald-300 text-xs font-mono font-bold px-2 py-0.5 rounded border border-emerald-500/30">
                Family ID: {selectedFamily.familyId}
              </span>
              <span className="bg-amber-500/20 text-amber-300 text-xs font-bold px-2 py-0.5 rounded border border-amber-500/30">
                {selectedFamily.rationCardType} Ration Card
              </span>
              <span className="bg-cyan-500/20 text-cyan-300 text-xs font-bold px-2 py-0.5 rounded border border-cyan-500/30">
                {selectedFamily.areaType === 'urban' ? 'IMC Urban Ward' : 'Janpad Panchayat'}
              </span>
            </div>

            <h3 className="text-2xl font-black font-heading mt-1">
              Head of Household: {selectedFamily.headName}
            </h3>

            <p className="text-xs text-slate-300 flex items-center space-x-1">
              <span>{selectedFamily.address}</span>
            </p>
          </div>

          <div className="flex items-center space-x-4 bg-white/10 p-3 rounded-2xl border border-white/10">
            <div className="text-center px-3">
              <div className="text-xl font-black text-amber-400 font-mono">{selectedFamily.members.length}</div>
              <div className="text-[10px] text-slate-300 uppercase">Members</div>
            </div>
            <div className="w-px h-8 bg-white/20" />
            <div className="text-center px-3">
              <div className="text-xl font-black text-emerald-400 font-mono">
                {selectedFamily.members.filter(m => m.ekycStatus).length}/{selectedFamily.members.length}
              </div>
              <div className="text-[10px] text-slate-300 uppercase">Aadhaar eKYC</div>
            </div>
            <div className="w-px h-8 bg-white/20" />
            <div className="text-center px-3">
              <div className="text-xl font-black text-cyan-400 font-mono">
                {selectedFamily.members.filter(m => m.dbtActive).length}/{selectedFamily.members.length}
              </div>
              <div className="text-[10px] text-slate-300 uppercase">DBT Active</div>
            </div>
          </div>
        </div>
      </div>

      {/* Two Column Layout: Family Members Tree & Member Entitlement Drawer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* LEFT: Family Members Tree (5 cols) */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200">
            <h3 className="text-sm font-bold text-slate-800 flex items-center space-x-1.5">
              <Users className="w-4 h-4 text-emerald-600" />
              <span>Family Tree Members ({selectedFamily.members.length})</span>
            </h3>
            <span className="text-xs text-slate-500">Click a member to inspect entitlements</span>
          </div>

          <div className="space-y-2.5">
            {selectedFamily.members.map(member => {
              const isSelected = selectedMember.memberId === member.memberId;

              return (
                <div
                  key={member.memberId}
                  onClick={() => setSelectedMember(member)}
                  className={`p-4 rounded-2xl border transition cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs'
                      : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-sm text-slate-900">{member.name}</span>
                        <span className="text-xs font-devanagari text-slate-500">({member.nameHindi})</span>
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {member.relation} • {member.age} yrs • {member.gender === 'female' ? 'Female' : 'Male'}
                      </div>
                      <div className="text-xs font-semibold text-slate-700 mt-1">
                        Occupation: <span className="text-emerald-700">{member.occupation}</span>
                      </div>
                    </div>

                    <div className="text-right font-mono text-xs">
                      <div className="text-slate-400 font-medium">ID: {member.memberId}</div>
                      <div className="mt-1 flex items-center justify-end space-x-1">
                        {member.ekycStatus ? (
                          <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center">
                            <CheckCircle className="w-3 h-3 text-emerald-600 mr-0.5" /> eKYC
                          </span>
                        ) : (
                          <span className="bg-rose-100 text-rose-800 text-[10px] font-bold px-1.5 py-0.5 rounded">
                            Pending eKYC
                          </span>
                        )}

                        {member.dbtActive && (
                          <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-1.5 py-0.5 rounded">
                            DBT ✓
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT: Selected Member Entitlement Matrix (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 border-b border-slate-200 gap-3">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                Active Member Entitlement Analysis
              </span>
              <h3 className="text-xl font-black text-slate-900 mt-1">
                {selectedMember.name} ({selectedMember.relation})
              </h3>
              <p className="text-xs text-slate-500 font-mono">
                Samagra 9-Digit Member ID: {selectedMember.memberId}
              </p>
            </div>

            <button
              onClick={() => onSelectMemberForProfile(selectedMember, selectedFamily)}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center space-x-1"
            >
              <span>Load Into Calculator</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Member eKYC & Bank Verification Card */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div className="text-[11px] text-slate-500">Aadhaar e-KYC:</div>
              <div className="text-xs font-bold text-emerald-700 flex items-center space-x-1 mt-0.5">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                <span>Verified with UIDAI</span>
              </div>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div className="text-[11px] text-slate-500">NPCI DBT Bank Link:</div>
              <div className="text-xs font-bold text-blue-700 flex items-center space-x-1 mt-0.5">
                <CreditCard className="w-3.5 h-3.5 text-blue-600" />
                <span>Active for Direct Payouts</span>
              </div>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div className="text-[11px] text-slate-500">Total Eligible Benefits:</div>
              <div className="text-xs font-black text-amber-700 font-mono mt-0.5">
                {eligibleSchemes.length} Scheme(s) Matched
              </div>
            </div>
          </div>

          {/* Eligible Schemes List for this Member */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center space-x-1.5">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                <span>100% Eligible Schemes for {selectedMember.name} ({eligibleSchemes.length})</span>
              </h4>
            </div>

            {eligibleSchemes.length === 0 ? (
              <div className="text-xs text-slate-500 bg-slate-50 p-4 rounded-xl border border-dashed border-slate-200 text-center">
                No immediate 100% matching schemes. Check the likely section below.
              </div>
            ) : (
              <div className="space-y-3">
                {eligibleSchemes.map(result => (
                  <div
                    key={result.scheme.id}
                    className="p-3.5 bg-emerald-50/60 rounded-xl border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-[10px] font-bold bg-emerald-600 text-white px-2 py-0.5 rounded-full">
                          100% Match
                        </span>
                        <span className="text-xs font-bold text-slate-900">{result.scheme.title}</span>
                      </div>
                      <p className="text-xs text-slate-600 mt-1">
                        Benefit:{' '}
                        <strong className="text-emerald-800">
                          {result.scheme.financialEntitlement.frequency === 'In-Kind / Service'
                            ? 'In-Kind Grant'
                            : `₹${result.scheme.financialEntitlement.amount.toLocaleString('en-IN')}`}
                        </strong>{' '}
                        ({result.scheme.financialEntitlement.frequency})
                      </p>
                    </div>

                    <button
                      onClick={() => onSelectMemberForProfile(selectedMember, selectedFamily)}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-700 text-white hover:bg-emerald-800 transition whitespace-nowrap self-start sm:self-auto"
                    >
                      Instant Apply
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Likely / Documentation Needed Schemes */}
          {likelySchemes.length > 0 && (
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center space-x-1.5 mb-3">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                <span>Likely Eligible ({likelySchemes.length}) — Pending Document Upload</span>
              </h4>

              <div className="space-y-2">
                {likelySchemes.slice(0, 3).map(result => (
                  <div key={result.scheme.id} className="p-3 bg-amber-50/50 rounded-xl border border-amber-200 text-xs">
                    <div className="font-bold text-slate-900">{result.scheme.title}</div>
                    <div className="text-[11px] text-amber-800 mt-0.5">
                      Missing from DigiLocker:{' '}
                      <span className="font-mono">{result.missingDocuments.join(', ')}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

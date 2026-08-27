import React from "react";
import {
  Sparkles, Bot, BrainCircuit, Target,
  CheckCircle2, Compass, Users, TrendingUp,
  Award, MapPin, Layers
} from "lucide-react";
import { LocationAnalytics } from "../../../types/location";

interface AIRecommendationSidebarProps {
  analytics: LocationAnalytics;
  candidateLat: number;
  candidateLng: number;
  radius: number;
}

const SCORE_GRADIENTS = [
  "from-indigo-500 to-cyan-400",
  "from-emerald-500 to-teal-400",
  "from-violet-600 to-purple-400",
  "from-pink-500 to-rose-400",
  "from-amber-500 to-orange-400"
];

const CARD_BORDER_GLOWS = [
  "hover:border-indigo-500/30 hover:shadow-indigo-500/5",
  "hover:border-emerald-500/30 hover:shadow-emerald-500/5",
  "hover:border-violet-500/30 hover:shadow-violet-500/5",
  "hover:border-pink-500/30 hover:shadow-pink-500/5",
  "hover:border-amber-500/30 hover:shadow-amber-500/5"
];

export default function AIRecommendationSidebar({
  analytics,
  candidateLat,
  candidateLng,
  radius,
}: AIRecommendationSidebarProps) {
  const { kpis, top_recommendations, explanation, features } = analytics;

  // Extract LLM recommendations with a robust fallback mapping
  const llmRec = analytics.llm_recommendation || {
    best_advertising_domains: (top_recommendations || []).map(r => ({
      category: r.category,
      score: r.score,
      rationale: r.reason
    })),
    why_domains_fit: explanation?.summary || "No specific spatial context was retrieved to justify custom domain matches.",
    advantages_of_publishing: explanation?.positive || ["No positive spatial factors were detected."],
    target_audience: [
      {
        segment: "General Commuters & Residents",
        driven_by: `${features?.total_pois || 0} local POIs, ${features?.bus_count || 0} transit stops`,
        relevance: "General brand exposure across default commuter demographics."
      }
    ],
    area_strength_summary: explanation?.summary || "Analyzing spatial indicators..."
  };

  const hasDomains = llmRec.best_advertising_domains && llmRec.best_advertising_domains.length > 0;



  return (
    <div className="w-full lg:w-[380px] lg:min-w-[380px] lg:max-w-[380px] border-t lg:border-t-0 lg:border-l border-border bg-card/20 p-6 flex flex-col space-y-6 lg:h-screen lg:overflow-y-auto text-foreground shrink-0">
      

      {/* HEADER */}
      <div className="flex items-center gap-3 border-b border-border/40 pb-4">
        <div className="p-2 rounded-xl bg-primary/10 border border-primary/20 text-primary">
          <Bot size={18} className="animate-pulse" />
        </div>
        <div>
          <h2 className="text-xs font-black uppercase tracking-widest text-primary leading-none">Media Strategy Agent</h2>
          <span className="text-[9px] text-muted-foreground font-bold uppercase mt-1 inline-block">LLM-Reasoned Assessment</span>
        </div>
      </div>




      {/* 3. BEST ADVERTISING DOMAINS */}
      <div className="glassmorphism p-5 rounded-2xl border border-border space-y-4">
        <div className="flex items-center gap-2">
          <Award size={14} className="text-primary" />
          <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Best Advertising Domains</h3>
        </div>
        
        {hasDomains ? (
          <div className="space-y-3">
            {llmRec.best_advertising_domains.map((dom, idx) => {
              const gradient = SCORE_GRADIENTS[idx % SCORE_GRADIENTS.length];
              const borderGlow = CARD_BORDER_GLOWS[idx % CARD_BORDER_GLOWS.length];
              return (
                <div key={dom.category} className={`bg-background/40 border border-border/60 p-3.5 rounded-xl space-y-2.5 transition-all duration-200 ${borderGlow}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-foreground">{dom.category}</span>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-xs font-black font-mono text-primary">{dom.score}%</span>
                      <span className="text-[9px] text-muted-foreground block font-bold uppercase tracking-wider">Suitability</span>
                    </div>
                  </div>
                  
                  {/* Progress Bar */}
                  <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full bg-gradient-to-r ${gradient} transition-all duration-1000`}
                      style={{ width: `${dom.score}%` }}
                    />
                  </div>
                  
                  <p className="text-[10.5px] text-muted-foreground leading-relaxed">
                    {dom.rationale}
                  </p>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-6 text-muted-foreground text-xs">
            No suitable advertising domains identified.
          </div>
        )}
      </div>

      {/* 4. WHY THESE DOMAINS FIT */}
      <div className="glassmorphism p-5 rounded-2xl border border-border space-y-3">
        <div className="flex items-center gap-2">
          <BrainCircuit size={14} className="text-primary" />
          <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground font-mono">Why These Domains Fit</h3>
        </div>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          {llmRec.why_domains_fit}
        </p>
      </div>

      {/* 5. ADVANTAGES OF PUBLISHING ADS IN THIS AREA */}
      <div className="glassmorphism p-5 rounded-2xl border border-border space-y-3">
        <div className="flex items-center gap-2">
          <Compass size={14} className="text-primary" />
          <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Advantages in This Area</h3>
        </div>
        <div className="space-y-2 pt-1">
          {llmRec.advantages_of_publishing && llmRec.advantages_of_publishing.length > 0 ? (
            llmRec.advantages_of_publishing.map((adv, idx) => (
              <div key={idx} className="flex gap-2.5 text-[11px] leading-relaxed text-muted-foreground hover:text-foreground transition-colors group">
                <CheckCircle2 size={13} className="text-emerald-400 shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
                <span>{adv}</span>
              </div>
            ))
          ) : (
            <span className="text-xs text-muted-foreground">No prominent advertising advantages detected.</span>
          )}
        </div>
      </div>

      {/* 6. TARGET AUDIENCE */}
      <div className="glassmorphism p-5 rounded-2xl border border-border space-y-4">
        <div className="flex items-center gap-2">
          <Users size={14} className="text-primary" />
          <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Target Audience Segments</h3>
        </div>
        <div className="space-y-3">
          {llmRec.target_audience && llmRec.target_audience.length > 0 ? (
            llmRec.target_audience.map((aud, idx) => (
              <div key={idx} className="bg-background/40 border border-border/60 p-3 rounded-xl space-y-2 hover:bg-background/60 transition-colors">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black text-foreground leading-tight">{aud.segment}</span>
                  <span className="px-1.5 py-0.5 bg-primary/10 border border-primary/20 text-primary text-[8px] font-black uppercase rounded-md shrink-0 ml-2">
                    {aud.segment.split(" ")[0]}
                  </span>
                </div>
                
                <p className="text-[10.5px] text-muted-foreground leading-relaxed">
                  {aud.relevance}
                </p>
                
                <div className="pt-1.5 border-t border-border/20 flex items-center justify-between text-[9px] text-muted-foreground/80 font-medium">
                  <span>Driven by:</span>
                  <span className="font-semibold text-primary/95">{aud.driven_by}</span>
                </div>
              </div>
            ))
          ) : (
            <span className="text-xs text-muted-foreground">No specific target audiences identified.</span>
          )}
        </div>
      </div>

    </div>
  );
}

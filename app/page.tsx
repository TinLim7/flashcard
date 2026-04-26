"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

const CTA_HREF = "/app";

const featureCards = [
  {
    title: "跨设备同步",
    desc: "学习进度实时接力，自动同步，换设备也不丢失",
    icon: "layers",
  },
  {
    title: "闪卡复习",
    desc: "单词、释义、例句一屏掌握，翻转之间加深记忆",
    icon: "card",
  },
  {
    title: "艾宾浩斯节奏",
    desc: "科学记忆曲线，该复习时自动提醒",
    icon: "bell",
  },
  {
    title: "易混词辨析",
    desc: "智能辨析相似词汇，精准区分形近词与近义词",
    icon: "bars",
  },
  {
    title: "学习统计",
    desc: "看见坚持，也看见进步，数据可视化激励前行",
    icon: "chart",
  },
  {
    title: "低压力设计",
    desc: "打开就能学，不被功能打扰，轻松开始无负担",
    icon: "heart",
  },
];

const painPoints = [
  { icon: "记", title: "记了又忘", desc: "复习没节奏，记忆很快消退" },
  { icon: "断", title: "学了就断", desc: "三天打鱼两天晒网，难以坚持" },
  { icon: "换", title: "换设备丢进度", desc: "数据不互通，学习体验割裂" },
  { icon: "碎", title: "碎片时间浪费", desc: "想学没方向，时间白白流逝" },
];

const scenes = [
  {
    label: "场景 1",
    title: "通勤 5 分钟",
    desc: "地铁上刷几组单词卡片，碎片时间变学习时刻",
    word: "breathe",
    phonetic: "/briːð/",
    meaning: "v. 深呼吸",
    bg: "#EFF6FF",
  },
  {
    label: "场景 2",
    title: "午休 10 分钟",
    desc: "饭后轻复习，短时高效，不占用整块时间",
    word: "calm",
    phonetic: "/kɑːm/",
    meaning: "adj. 平静的",
    bg: "#FFFBEB",
  },
  {
    label: "场景 3",
    title: "睡前轻复习",
    desc: "巩固记忆黄金期，睡前几分钟加深印象",
    word: "dream",
    phonetic: "/driːm/",
    meaning: "n. 梦想",
    bg: "#EEF2FF",
  },
  {
    label: "场景 4",
    title: "电脑整理，手机巩固",
    desc: "大屏整理错题，小屏随时巩固，完美搭配",
    word: "sync",
    phonetic: "/sɪŋk/",
    meaning: "v. 同步",
    bg: "#ECFDF5",
  },
];

const stats = [
  { value: 82, suffix: "%", label: "平均掌握率", desc: "科学复习让记忆更牢固", max: 100 },
  { value: 12, suffix: " 天", label: "平均连续 streak", desc: "小目标养成好习惯", max: 20 },
  { value: 128, suffix: " 张", label: "每周学习卡片数", desc: "积少成多见真章", max: 200 },
];

function Icon({ name, className = "" }: { name: string; className?: string }) {
  const common = {
    className,
    width: 22,
    height: 22,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  switch (name) {
    case "layers":
      return (
        <svg {...common}>
          <path d="M12 2 2 7l10 5 10-5-10-5Z" />
          <path d="m2 17 10 5 10-5" />
          <path d="m2 12 10 5 10-5" />
        </svg>
      );
    case "card":
      return (
        <svg {...common}>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M7 9h10M7 13h7" />
        </svg>
      );
    case "bell":
      return (
        <svg {...common}>
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      );
    case "bars":
      return (
        <svg {...common}>
          <path d="M18 20V10M12 20V4M6 20v-6" />
        </svg>
      );
    case "chart":
      return (
        <svg {...common}>
          <path d="M3 3v18h18" />
          <path d="m18.7 8-5.1 5.2-2.8-2.7L7 14.3" />
        </svg>
      );
    case "heart":
      return (
        <svg {...common}>
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78Z" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <path d="M12 5v14M5 12h14" />
        </svg>
      );
  }
}

function useLandingEffects(rootRef: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const root = rootRef.current;
    const canvas = root?.querySelector<HTMLCanvasElement>("#particles-canvas");
    const nav = root?.querySelector<HTMLElement>("#landing-nav");
    if (!root || !canvas) {
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    let animationFrame = 0;
    const particles = Array.from({ length: window.innerWidth < 768 ? 20 : 50 }, () => ({
      x: 0,
      y: 0,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      radius: Math.random() * 2 + 0.8,
      opacity: Math.random() * 0.25 + 0.08,
    }));

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) {
        return;
      }
      canvas.width = parent.offsetWidth;
      canvas.height = parent.offsetHeight;
      particles.forEach((particle) => {
        particle.x = Math.random() * canvas.width;
        particle.y = Math.random() * canvas.height;
      });
    };

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((particle) => {
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.vx *= 0.995;
        particle.vy *= 0.995;
        if (particle.x < 0) particle.x = canvas.width;
        if (particle.x > canvas.width) particle.x = 0;
        if (particle.y < 0) particle.y = canvas.height;
        if (particle.y > canvas.height) particle.y = 0;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(147, 197, 253, ${particle.opacity})`;
        ctx.fill();
      });

      for (let i = 0; i < particles.length; i += 1) {
        for (let j = i + 1; j < particles.length; j += 1) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance < 160) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(147, 197, 253, ${(1 - distance / 160) * 0.1})`;
            ctx.lineWidth = 0.4;
            ctx.stroke();
          }
        }
      }
      animationFrame = requestAnimationFrame(animate);
    };

    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("landing-revealed");
            revealObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 },
    );

    root.querySelectorAll(".landing-reveal").forEach((element) => revealObserver.observe(element));

    const statObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            return;
          }
          const card = entry.target as HTMLElement;
          const ring = card.querySelector<SVGCircleElement>(".landing-stat-ring");
          const number = card.querySelector<HTMLElement>(".landing-stat-number");
          const target = Number(card.dataset.value || 0);
          const max = Number(card.dataset.max || 100);
          const circumference = 2 * Math.PI * 42;
          if (ring) {
            ring.style.strokeDasharray = `${circumference}`;
            ring.style.strokeDashoffset = `${circumference - (target / max) * circumference}`;
          }
          if (number) {
            const startedAt = performance.now();
            const tick = (now: number) => {
              const progress = Math.min((now - startedAt) / 1200, 1);
              number.textContent = String(Math.round(target * progress));
              if (progress < 1) {
                requestAnimationFrame(tick);
              }
            };
            requestAnimationFrame(tick);
          }
          statObserver.unobserve(card);
        });
      },
      { threshold: 0.35 },
    );

    root.querySelectorAll(".landing-stat-card").forEach((element) => statObserver.observe(element));

    const handleScroll = () => {
      if (!nav) {
        return;
      }
      nav.classList.toggle("landing-nav-scrolled", window.scrollY > 30);
    };

    resize();
    animate();
    handleScroll();
    window.addEventListener("resize", resize);
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", resize);
      window.removeEventListener("scroll", handleScroll);
      revealObserver.disconnect();
      statObserver.disconnect();
    };
  }, [rootRef]);
}

export default function LandingPage() {
  const rootRef = useRef<HTMLDivElement | null>(null);
  useLandingEffects(rootRef);

  return (
    <main ref={rootRef} className="landing-page min-h-screen overflow-x-hidden bg-[#F8FBFF] text-[#334155]">
      <nav id="landing-nav" className="fixed left-0 right-0 top-0 z-50 transition-all duration-300">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-6 py-3.5">
          <Link href="/landing" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#2563EB] shadow-sm">
              <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
                <rect x="2" y="3" width="12" height="10" rx="2" stroke="white" strokeWidth="1.5" />
                <line x1="5" y1="7" x2="11" y2="7" stroke="white" strokeWidth="1.5" />
                <line x1="5" y1="10" x2="9" y2="10" stroke="white" strokeWidth="1.5" />
              </svg>
            </div>
            <span className="font-display text-xl font-bold tracking-tight text-[#1E3A5F]">Flashcard</span>
          </Link>
          <div className="hidden items-center gap-7 text-sm text-[#64748B] md:flex">
            <a href="#features" className="landing-link hover:text-[#2563EB]">
              功能
            </a>
            <a href="#sync" className="landing-link hover:text-[#2563EB]">
              同步
            </a>
            <a href="#scenes" className="landing-link hover:text-[#2563EB]">
              场景
            </a>
            <a href="#stats" className="landing-link hover:text-[#2563EB]">
              数据
            </a>
          </div>
          <Link
            href={CTA_HREF}
            className="rounded-full bg-[#2563EB] px-5 py-2 text-sm font-medium text-white shadow-md shadow-blue-500/15 transition-all hover:scale-[1.02] hover:bg-[#1E3A5F]"
          >
            立即开始
          </Link>
        </div>
      </nav>

      <section className="landing-mesh-bg relative flex min-h-screen items-center overflow-hidden pt-16">
        <canvas id="particles-canvas" className="pointer-events-none absolute inset-0 z-0 h-full w-full" />
        <div className="relative z-10 mx-auto w-full max-w-[1200px] px-6">
          <div className="grid min-h-[80vh] items-center gap-4 lg:grid-cols-12 lg:gap-6">
            <div className="order-2 text-center lg:order-1 lg:col-span-5 lg:text-left">
              <div className="landing-hero-item flex items-center justify-center gap-2.5 delay-100 lg:justify-start">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#2563EB]/10 text-[#10B981]">
                  <Icon name="heart" className="h-4 w-4" />
                </div>
                <span className="text-sm font-medium text-[#10B981]">轻松学习，自然坚持</span>
              </div>
              <p className="landing-hero-item mt-5 font-display text-lg tracking-wide text-[#3B82F6] delay-200 md:text-xl">
                Learn anywhere. Stay in flow.
              </p>
              <h1 className="landing-hero-item mt-3 text-[42px] font-bold leading-[1.15] text-[#1E3A5F] delay-300 md:text-[52px] lg:text-[56px]">
                让英语学习
                <br />
                <span className="text-[#2563EB]">自然融入一天</span>
              </h1>
              <p className="landing-hero-item mx-auto mt-5 max-w-lg text-base leading-relaxed text-[#64748B] delay-500 lg:mx-0 md:text-lg">
                轻量闪卡记忆工具 · 跨设备同步 · 碎片时间也能继续学
              </p>
              <div className="landing-hero-item mt-8 flex flex-col items-center justify-center gap-4 delay-700 sm:flex-row lg:justify-start">
                <Link
                  href={CTA_HREF}
                  className="rounded-full bg-[#2563EB] px-8 py-3.5 font-medium text-white shadow-lg shadow-blue-500/20 transition-all hover:scale-[1.02] hover:bg-[#1E3A5F]"
                >
                  免费开始使用
                </Link>
                <a href="#features" className="text-sm text-[#64748B] transition-colors hover:text-[#2563EB]">
                  探索更多
                </a>
              </div>
            </div>

            <div className="relative hidden h-[560px] lg:col-span-2 lg:block">
              {["joy", "calm", "flow", "ease"].map((word, index) => (
                <div
                  key={word}
                  className="landing-float-tag absolute rounded-[10px] border border-slate-200/60 bg-white/90 px-3.5 py-2 font-display text-[13px] text-[#1E3A5F] shadow-sm backdrop-blur-xl"
                  style={{
                    top: ["15%", "35%", "58%", "78%"][index],
                    left: ["20%", "auto", "5%", "auto"][index],
                    right: ["auto", "10%", "auto", "25%"][index],
                    animationDelay: `${1.1 + index * 0.14}s`,
                  }}
                >
                  <span>{word}</span>
                  <span className="block text-[9px] text-[#94A3B8]">/{word === "joy" ? "dʒɔɪ" : word}/</span>
                </div>
              ))}
            </div>

            <div className="order-1 flex justify-center lg:order-3 lg:col-span-5 lg:justify-end">
              <div className="relative">
                <div className="absolute left-1/2 top-1/2 h-[320px] w-[320px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-blue-200/20 to-sky-100/40 blur-3xl md:h-[400px] md:w-[400px]" />
                <div className="landing-phone relative z-10 h-[500px] w-[260px] overflow-hidden rounded-[32px] border-[6px] border-[#1E3A5F] bg-white shadow-[0_40px_100px_rgba(30,58,95,0.28)] md:h-[600px] md:w-[300px]">
                  <div className="flex h-full flex-col bg-gradient-to-b from-[#F8FBFF] via-white to-[#F0F9FF] p-3.5">
                    <div className="mb-3 flex justify-center">
                      <div className="h-[18px] w-20 rounded-full bg-[#1E3A5F]" />
                    </div>
                    <div className="mb-2.5 text-center">
                      <p className="text-[10px] uppercase tracking-wide text-[#94A3B8]">Today&apos;s Study</p>
                      <p className="mt-0.5 text-xl font-bold text-[#1E3A5F]">
                        24 <span className="text-xs font-normal text-[#94A3B8]">/ 50 cards</span>
                      </p>
                      <div className="mt-1.5 h-[3px] w-full overflow-hidden rounded-full bg-[#E2E8F0]">
                        <div className="h-full w-[48%] rounded-full bg-[#2563EB]" />
                      </div>
                      <span className="mt-2 inline-flex text-[9px] font-medium text-[#F59E0B]">连续 7 天</span>
                    </div>
                    <div className="mx-0.5 flex flex-1 flex-col justify-between rounded-[18px] border border-slate-200/60 bg-white p-4 shadow-md">
                      <div>
                        <div className="mb-2.5 flex items-start justify-between">
                          <span className="rounded-full bg-[#E0F2FE]/60 px-2 py-0.5 text-[9px] text-[#94A3B8]">核心词汇</span>
                          <span className="text-[#F59E0B]">★</span>
                        </div>
                        <h3 className="font-display text-[22px] leading-tight text-[#1E3A5F]">serene</h3>
                        <p className="text-[11px] text-[#64748B]">/səˈriːn/</p>
                        <p className="mb-2 text-xs text-[#334155]">adj. 平静安详的</p>
                        <div className="mb-2 rounded-lg bg-[#E0F2FE]/40 p-2.5">
                          <p className="text-[11px] italic leading-snug text-[#334155]">
                            &quot;The lake was serene in the early morning.&quot;
                          </p>
                          <p className="mt-1 text-[9px] text-[#94A3B8]">清晨，湖面平静而安详。</p>
                        </div>
                        <p className="mb-1 text-[9px] text-[#94A3B8]">常见搭配</p>
                        <div className="mb-2 flex flex-wrap gap-1">
                          <span className="rounded-md bg-[#F1F5F9] px-1.5 py-0.5 text-[9px] text-[#64748B]">serene smile</span>
                          <span className="rounded-md bg-[#F1F5F9] px-1.5 py-0.5 text-[9px] text-[#64748B]">serene beauty</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          <span className="rounded-full bg-[#10B981]/10 px-1.5 py-0.5 text-[9px] text-[#10B981]">已掌握</span>
                          <span className="rounded-full bg-[#F59E0B]/10 px-1.5 py-0.5 text-[9px] text-[#F59E0B]">需复习</span>
                        </div>
                      </div>
                      <div className="mt-2 flex gap-2.5">
                        <button className="flex-1 rounded-xl border border-slate-200 py-2 text-xs text-[#64748B]">不认识</button>
                        <button className="flex-1 rounded-xl bg-[#2563EB] py-2 text-xs text-white">认识</button>
                      </div>
                    </div>
                    <div className="mt-2.5 flex items-center justify-around pt-1 text-[9px] text-[#94A3B8]">
                      <span className="font-medium text-[#2563EB]">学习</span>
                      <span>复习</span>
                      <span>统计</span>
                      <span>我的</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-28 md:py-36" style={{ background: "linear-gradient(180deg, #E0F2FE 0%, #F8FBFF 12%, #FFFFFF 35%, #FFFFFF 65%, #F0F9FF 100%)" }}>
        <div className="mx-auto max-w-[1200px] px-6">
          <SectionTitle eyebrow="Pain Points" title="你是不是也这样？" subtitle="学习英语的路上，这些困扰太常见" />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {painPoints.map((item) => (
              <div key={item.title} className="landing-reveal landing-card rounded-2xl border border-[#E2E8F0] bg-white p-5 sm:p-7">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[#E0F2FE]/70 text-sm font-bold text-[#2563EB]">
                  {item.icon}
                </div>
                <h3 className="mb-1.5 text-base font-bold text-[#1E3A5F]">{item.title}</h3>
                <p className="text-sm leading-relaxed text-[#64748B]">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="features" className="relative overflow-hidden py-28 md:py-36" style={{ background: "linear-gradient(180deg, #F0F9FF 0%, #F8FBFF 30%, #F8FBFF 70%, #FFFFFF 100%)" }}>
        <BlurOrb className="right-[-10%] top-[-10%] h-[500px] w-[500px] bg-blue-200/20" />
        <BlurOrb className="bottom-[-5%] left-[-5%] h-[400px] w-[400px] bg-sky-100/30" />
        <div className="relative z-10 mx-auto max-w-[1200px] px-6">
          <SectionTitle eyebrow="Features" title="一个学习流，跨所有屏幕" subtitle="手机开始 · 平板继续 · 电脑收尾" />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {featureCards.map((item) => (
              <div key={item.title} className="landing-reveal landing-card rounded-2xl border border-slate-200/60 bg-white p-5 sm:p-7">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-[#E0F2FE]/60 text-[#2563EB]">
                  <Icon name={item.icon} />
                </div>
                <h3 className="mb-1.5 text-base font-bold text-[#1E3A5F]">{item.title}</h3>
                <p className="text-sm leading-relaxed text-[#64748B]">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="sync" className="overflow-hidden py-28 md:py-36" style={{ background: "linear-gradient(180deg, #FFFFFF 0%, #F8FBFF 100%)" }}>
        <div className="mx-auto max-w-[1200px] px-6">
          <div className="grid items-center gap-16 lg:grid-cols-2 lg:gap-20">
            <div className="landing-reveal flex flex-col items-center gap-4">
              <div className="flex origin-bottom scale-[0.85] select-none items-end justify-center gap-2 sm:scale-100 sm:gap-3 md:gap-4">
                <DeviceCard size="phone" title="On Phone" action="开始学习" word="bloom" />
                <DeviceCard size="tablet" title="On Tablet" action="继续学习" word="bloom" />
                <DeviceCard size="laptop" title="On Desktop" action="完成复习" word="done" />
              </div>
              <div className="landing-glass flex w-full max-w-[340px] items-center justify-center gap-3 rounded-2xl px-6 py-3 shadow-lg sm:w-auto">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#2563EB]/10 text-[#2563EB]">
                  <Icon name="layers" className="h-4 w-4" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-bold text-[#1E3A5F]">Seamless Sync</p>
                  <p className="text-[11px] text-[#94A3B8]">学习节奏，不被设备打断</p>
                </div>
              </div>
            </div>
            <div className="landing-reveal">
              <p className="mb-3 text-sm font-medium uppercase tracking-widest text-[#93C5FD]">Cross-Device</p>
              <p className="mb-3 font-display text-2xl text-[#3B82F6] md:text-3xl">
                One learning flow,
                <br />
                across every screen
              </p>
              <h3 className="mb-5 text-2xl font-bold leading-snug text-[#1E3A5F] md:text-[32px]">
                随时切换
                <br />
                随时进入状态
              </h3>
              <p className="mb-8 text-[15px] leading-[1.8] text-[#64748B]">
                通勤路上用手机刷几组单词，午休时用平板集中复习，晚上用电脑整理错题，Flashcard 让你的学习无缝衔接，从不中断。
              </p>
              <div className="space-y-4">
                {["实时同步学习进度", "学习数据安全可靠", "多端无缝自然衔接"].map((item) => (
                  <div key={item} className="flex items-center gap-3.5 rounded-xl p-3 transition-colors hover:bg-[#F8FBFF]">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#E0F2FE]/60 text-[#2563EB]">
                      <Icon name="layers" className="h-[18px] w-[18px]" />
                    </div>
                    <span className="text-[15px] text-[#334155]">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="scenes" className="py-28 md:py-36" style={{ background: "linear-gradient(180deg, #F8FBFF 0%, #FFFFFF 100%)" }}>
        <div className="mx-auto max-w-[1000px] px-6">
          <SectionTitle eyebrow="Scenes" title="随时进入学习状态" subtitle="任何时间、任何地点，自然开始学习" />
          <div className="space-y-6">
            {scenes.map((scene) => (
              <div key={scene.title} className="landing-reveal landing-glass rounded-[24px] p-5 sm:p-6 md:p-8">
                <div className="grid items-center gap-5 md:grid-cols-2 md:gap-10">
                  <div className="order-2 md:order-1">
                    <div className="mb-4 flex items-center gap-3">
                      <span className="rounded-full border border-slate-200/70 bg-white/80 px-3 py-1 text-[11px] font-medium text-[#64748B]">
                        {scene.label}
                      </span>
                    </div>
                    <h3 className="mb-3 text-xl font-bold text-[#1E3A5F] md:text-2xl">{scene.title}</h3>
                    <p className="text-[15px] leading-[1.8] text-[#64748B]">{scene.desc}</p>
                  </div>
                  <div className="order-1 flex justify-center md:order-2">
                    <div className="w-full max-w-[260px] rounded-[20px] border border-white/60 p-5 shadow-lg" style={{ background: scene.bg }}>
                      <div className="rounded-[14px] border border-slate-200/40 bg-white p-4 shadow-sm">
                        <span className="rounded-full bg-gray-50 px-2 py-0.5 text-[9px] text-[#94A3B8]">核心词汇</span>
                        <p className="mt-2.5 font-display text-[20px] leading-tight text-[#1E3A5F]">{scene.word}</p>
                        <p className="mt-0.5 text-[11px] text-[#64748B]">{scene.phonetic}</p>
                        <p className="mt-1.5 text-xs text-[#334155]">{scene.meaning}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white py-28 md:py-36">
        <div className="mx-auto max-w-[1200px] px-6">
          <div className="mb-24">
            <SectionTitle eyebrow="For You" title="适合这样的你" />
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {["英语自学者", "想提升词汇量", "容易半途而废", "需要跨设备学习"].map((title) => (
                <SmallCard key={title} title={title} />
              ))}
            </div>
          </div>
          <SectionTitle eyebrow="Gains" title="你将获得" />
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {["更稳定的复习节奏", "更清楚的学习进度", "更轻松的坚持方式", "更完整的跨端体验"].map((title) => (
              <SmallCard key={title} title={title} />
            ))}
          </div>
        </div>
      </section>

      <section id="stats" className="relative overflow-hidden py-28 md:py-36" style={{ background: "linear-gradient(180deg, #F0F9FF 0%, #E0F2FE 50%, #F0F9FF 100%)" }}>
        <BlurOrb className="left-[-10%] top-[-20%] h-[600px] w-[600px] bg-blue-200/20" />
        <BlurOrb className="bottom-[-15%] right-[-5%] h-[500px] w-[500px] bg-sky-100/30" />
        <div className="relative z-10 mx-auto max-w-[1200px] px-6">
          <SectionTitle eyebrow="Numbers" title="学习数据，见证成长" subtitle="用数字说话，看见每一份坚持的价值" />
          <div className="grid gap-6 sm:grid-cols-3">
            {stats.map((stat) => (
              <div
                key={stat.label}
                data-value={stat.value}
                data-max={stat.max}
                className="landing-reveal landing-stat-card landing-card rounded-[20px] border border-white/60 bg-white/80 p-8 text-center backdrop-blur-sm"
              >
                <div className="relative mx-auto mb-5 h-[80px] w-[80px]">
                  <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="42" fill="none" stroke="#E2E8F0" strokeWidth="6" />
                    <circle
                      className="landing-stat-ring"
                      cx="50"
                      cy="50"
                      r="42"
                      fill="none"
                      stroke="#2563EB"
                      strokeLinecap="round"
                      strokeWidth="6"
                      style={{ strokeDasharray: 263.89, strokeDashoffset: 263.89 }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center gap-0.5">
                    <span className="landing-stat-number font-display text-xl font-bold text-[#1E3A5F]">0</span>
                    <span className="font-display text-xs font-semibold text-[#1E3A5F]/70">{stat.suffix}</span>
                  </div>
                </div>
                <h4 className="mb-1 text-base font-bold text-[#1E3A5F]">{stat.label}</h4>
                <p className="text-sm text-[#64748B]">{stat.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative flex min-h-[85vh] items-center justify-center overflow-hidden" style={{ background: "linear-gradient(180deg, #F0F9FF 0%, #F8FBFF 100%)" }}>
        <BlurOrb className="left-[5%] top-[5%] h-[500px] w-[500px] animate-drift bg-blue-200/20" />
        <BlurOrb className="right-0 top-[45%] h-[400px] w-[400px] animate-drift bg-sky-100/30" />
        <div className="relative z-10 mx-auto max-w-2xl px-6 text-center">
          <p className="landing-reveal mb-6 text-sm font-medium uppercase tracking-widest text-[#93C5FD]">Philosophy</p>
          <h2 className="landing-reveal mb-5 font-display text-[42px] leading-tight text-[#1E3A5F] md:text-[56px]">
            Small moments,
            <br />
            real progress
          </h2>
          <p className="landing-reveal mb-2 text-xl font-bold text-[#1E3A5F] md:text-2xl">不是逼自己学更久</p>
          <p className="landing-reveal mb-8 text-xl font-bold text-[#1E3A5F] md:text-2xl">而是让学习更容易开始</p>
          <p className="landing-reveal mb-10 text-base text-[#64748B]">每天进步一点点 · 未来会感谢现在坚持的你</p>
          <Link
            href={CTA_HREF}
            className="landing-reveal inline-flex rounded-full bg-[#2563EB] px-10 py-4 text-base font-medium text-white shadow-2xl shadow-blue-500/20 transition-all hover:scale-[1.02] hover:bg-[#1E3A5F] md:text-lg"
          >
            开启我的 Flashcard 之旅
          </Link>
        </div>
      </section>

      <footer className="bg-[#1E3A5F] py-16">
        <div className="mx-auto max-w-[1200px] px-6">
          <div className="grid items-start gap-12 md:grid-cols-2">
            <div>
              <div className="mb-4 flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10">
                  <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
                    <rect x="2" y="3" width="12" height="10" rx="2" stroke="white" strokeWidth="1.5" />
                    <line x1="5" y1="7" x2="11" y2="7" stroke="white" strokeWidth="1.5" />
                    <line x1="5" y1="10" x2="9" y2="10" stroke="white" strokeWidth="1.5" />
                  </svg>
                </div>
                <span className="font-display text-2xl font-bold text-white">Flashcard</span>
              </div>
              <p className="text-sm leading-relaxed text-white/50">
                Learn anywhere. Stay in flow.
                <br />
                让英语学习，自然融入每一天。
              </p>
            </div>
            <div className="flex flex-col gap-3 md:items-end">
              <a href="#features" className="text-sm text-white/50 transition-colors hover:text-white/90">
                功能介绍
              </a>
              <a href="#sync" className="text-sm text-white/50 transition-colors hover:text-white/90">
                跨设备同步
              </a>
              <a href="#scenes" className="text-sm text-white/50 transition-colors hover:text-white/90">
                学习场景
              </a>
              <a href="#stats" className="text-sm text-white/50 transition-colors hover:text-white/90">
                数据统计
              </a>
            </div>
          </div>
          <div className="mt-12 border-t border-white/10 pt-8 text-center text-sm text-white/30 md:text-left">
            © 2026 Flashcard. All rights reserved.
          </div>
        </div>
      </footer>
    </main>
  );
}

function SectionTitle({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="landing-reveal mb-16 text-center">
      <p className="mb-3 text-sm font-medium uppercase tracking-widest text-[#93C5FD]">{eyebrow}</p>
      <h2 className="text-3xl font-bold leading-tight text-[#1E3A5F] md:text-[40px]">{title}</h2>
      {subtitle ? <p className="mt-3 text-base text-[#64748B] md:text-lg">{subtitle}</p> : null}
    </div>
  );
}

function DeviceCard({
  size,
  title,
  action,
  word,
}: {
  size: "phone" | "tablet" | "laptop";
  title: string;
  action: string;
  word: string;
}) {
  const sizeClass =
    size === "phone"
      ? "h-[220px] w-[110px] rotate-[-6deg] rounded-[22px] sm:h-[260px] sm:w-[130px]"
      : size === "tablet"
        ? "h-[220px] w-[160px] rounded-[18px] sm:h-[260px] sm:w-[190px]"
        : "h-[130px] w-[180px] rotate-2 rounded-t-[10px] sm:h-[150px] sm:w-[220px]";

  return (
    <div className={`${sizeClass} z-10 overflow-hidden border-[5px] border-[#1E3A5F]/90 bg-white shadow-xl`}>
      <div className="flex h-full flex-col bg-gradient-to-b from-[#E0F2FE]/60 to-white p-3 text-center">
        <p className="mt-4 text-[8px] text-[#94A3B8]">{title}</p>
        <p className="mt-1 text-[8px] font-medium text-[#2563EB]">{action}</p>
        <div className="mx-auto mt-3 w-[78%] rounded-lg border border-slate-200/40 bg-white p-2 shadow-sm">
          <p className="font-display text-[12px] text-[#1E3A5F]">{word}</p>
          {size !== "laptop" ? <p className="text-[7px] text-[#94A3B8]">/bluːm/</p> : <p className="text-[7px] text-[#10B981]">已掌握</p>}
        </div>
        <p className="mt-2 text-[8px] text-[#2563EB]">{size === "laptop" ? "128 词" : "23 / 50"}</p>
      </div>
    </div>
  );
}

function SmallCard({ title }: { title: string }) {
  return (
    <div className="landing-reveal landing-card rounded-2xl border border-slate-200/50 bg-white p-6 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#E0F2FE]/70 text-[#2563EB]">
        <Icon name="heart" />
      </div>
      <h4 className="mb-1 text-base font-bold text-[#1E3A5F]">{title}</h4>
      <p className="text-sm text-[#334155]">轻量开始，稳定推进</p>
    </div>
  );
}

function BlurOrb({ className }: { className: string }) {
  return <div className={`pointer-events-none absolute rounded-full blur-[120px] ${className}`} />;
}

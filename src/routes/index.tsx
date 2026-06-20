import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import trafficAsset from "../assets/traffic.jpg.asset.json";
import roadAsset from "../assets/road.jpg.asset.json";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Syros EV — Sound vs Silence" },
      { name: "description", content: "Less Noise. More Journey. The silent power of Syros EV." },
      { property: "og:title", content: "Syros EV — Sound vs Silence" },
      { property: "og:description", content: "Less Noise. More Journey. The silent power of Syros EV." },
    ],
  }),
  component: Index,
});

const TRAFFIC_IMG = trafficAsset.url;
const ROAD_IMG = roadAsset.url;
const LEFT_VIDEO =
  "https://cdn.pixelkart.ai/uploads/2026/june/19/creative_fe0cb530.mp4";
const RIGHT_VIDEO =
  "https://cdn.pixelkart.ai/uploads/2026/june/19/creative_aff2030f.mp4";


type WaveProps = {
  count: number;
  amplitude: number;
  speed: number;
  color: string;
  opacity: number;
  width: number;
  height: number;
  chaotic?: boolean;
};

function SoundWave({
  count,
  amplitude,
  speed,
  color,
  opacity,
  width,
  height,
  chaotic = false,
}: WaveProps) {
  const buildPath = (phase: number, freq: number, amp: number) => {
    const steps = 80;
    const pts: string[] = [];
    for (let i = 0; i <= steps; i++) {
      const x = (i / steps) * width;
      const y =
        height / 2 +
        Math.sin((i / steps) * Math.PI * 2 * freq + phase) * amp +
        (chaotic ? Math.sin((i / steps) * Math.PI * 2 * freq * 2.3 + phase) * amp * 0.35 : 0);
      pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    }
    return pts.join(" ");
  };

  const lines = Array.from({ length: count }, (_, i) => {
    const freq = chaotic ? 3 + i * 0.7 : 1 + i * 0.3;
    const amp = amplitude * (1 - i / (count * 2));
    const phase = i * 0.9;
    const dur = speed + (chaotic ? i * 0.15 : i * 0.6);
    return { phase, freq, amp, dur, idx: i };
  });

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ opacity, display: "block" }}
      preserveAspectRatio="none"
    >
      {lines.map((l) => {
        const animName = chaotic ? "sv-wave-chaos" : "sv-wave-calm";
        return (
          <polyline
            key={l.idx}
            fill="none"
            stroke={color}
            strokeWidth={chaotic ? 1.6 : 1.4}
            strokeLinecap="round"
            points={buildPath(l.phase, l.freq, l.amp)}
            style={{
              transformOrigin: "center",
              animation: `${animName} ${l.dur}s ease-in-out infinite`,
              animationDelay: `${l.idx * 0.12}s`,
            }}
          />
        );
      })}
    </svg>
  );
}

function Index() {
  const [currentState, setCurrentState] = useState<number>(1);
  const [popupVisible, setPopupVisible] = useState(false);
  const [soundOn, setSoundOn] = useState(true);

  const leftVideoRef = useRef<HTMLVideoElement | null>(null);
  const userInteractedRef = useRef(false);

  const audioRef = useRef<{
    ctx: AudioContext;
    chaosGain: GainNode;
    peaceGain: GainNode;
    masterGain: GainNode;
    nodes: AudioNode[];
  } | null>(null);

  useEffect(() => {
    const a = ensureAudio();
    a.ctx.resume().catch(() => {});
    const t1 = setTimeout(() => setCurrentState(2), 3000);
    return () => clearTimeout(t1);
  }, []);

  useEffect(() => {
    if (currentState === 2) {
      const t = setTimeout(() => setPopupVisible(true), 1200);
      return () => clearTimeout(t);
    }
  }, [currentState]);

  const playVideoAudio = () => {
    const a = ensureAudio();
    if (a.ctx.state === "suspended") a.ctx.resume();
    if (leftVideoRef.current?.muted) {
      leftVideoRef.current.muted = false;
      leftVideoRef.current.play().catch(() => {});
    }
  };

  useEffect(() => {
    if (currentState === 2 && leftVideoRef.current) {
      playVideoAudio();
    }
  }, [currentState]);

  useEffect(() => {
    const onGesture = () => {
      if (!userInteractedRef.current) {
        userInteractedRef.current = true;
        playVideoAudio();
      }
    };
    const evts = ["pointerdown", "keydown", "wheel", "touchstart"];
    evts.forEach((e) => document.addEventListener(e, onGesture));
    return () => evts.forEach((e) => document.removeEventListener(e, onGesture));
  }, []);

  const leftWidth =
    currentState === 1 ? 50 : currentState === 2 ? 75 : 0;
  const rightWidth = 100 - leftWidth;

  const goState3 = () => {
    setPopupVisible(false);
    setCurrentState(3);
    if (leftVideoRef.current) {
      leftVideoRef.current.muted = true;
    }
  };

  // Build the audio graph once
  const ensureAudio = () => {
    if (audioRef.current) return audioRef.current;
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    const ctx = new AC();

    const masterGain = ctx.createGain();
    masterGain.gain.value = 0.6;
    masterGain.connect(ctx.destination);

    // ---- CHAOS BUS: filtered noise + low rumble + sporadic "horn" ----
    const chaosGain = ctx.createGain();
    chaosGain.gain.value = 0;
    chaosGain.connect(masterGain);

    // brown-ish noise buffer
    const bufferSize = 2 * ctx.sampleRate;
    const noiseBuf = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      lastOut = (lastOut + 0.02 * white) / 1.02;
      data[i] = lastOut * 3.5;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuf;
    noise.loop = true;
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = "bandpass";
    noiseFilter.frequency.value = 600;
    noiseFilter.Q.value = 0.6;
    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.55;
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(chaosGain);
    noise.start();

    // low engine rumble
    const rumble = ctx.createOscillator();
    rumble.type = "sawtooth";
    rumble.frequency.value = 55;
    const rumbleLfo = ctx.createOscillator();
    rumbleLfo.frequency.value = 0.3;
    const rumbleLfoGain = ctx.createGain();
    rumbleLfoGain.gain.value = 6;
    rumbleLfo.connect(rumbleLfoGain);
    rumbleLfoGain.connect(rumble.frequency);
    const rumbleFilter = ctx.createBiquadFilter();
    rumbleFilter.type = "lowpass";
    rumbleFilter.frequency.value = 180;
    const rumbleGain = ctx.createGain();
    rumbleGain.gain.value = 0.18;
    rumble.connect(rumbleFilter);
    rumbleFilter.connect(rumbleGain);
    rumbleGain.connect(chaosGain);
    rumble.start();
    rumbleLfo.start();

    // sporadic car horn beeps
    const horn = ctx.createOscillator();
    horn.type = "square";
    horn.frequency.value = 440;
    const hornGain = ctx.createGain();
    hornGain.gain.value = 0;
    horn.connect(hornGain);
    hornGain.connect(chaosGain);
    horn.start();
    const scheduleHorn = () => {
      const now = ctx.currentTime;
      const freq = 280 + Math.random() * 260;
      horn.frequency.setValueAtTime(freq, now);
      hornGain.gain.cancelScheduledValues(now);
      hornGain.gain.setValueAtTime(0, now);
      hornGain.gain.linearRampToValueAtTime(0.12, now + 0.05);
      hornGain.gain.linearRampToValueAtTime(0, now + 0.35);
    };
    const hornTimer = window.setInterval(
      () => Math.random() < 0.6 && scheduleHorn(),
      1800,
    );

    // ---- PEACE BUS: soft pad of detuned sines + airy noise ----
    const peaceGain = ctx.createGain();
    peaceGain.gain.value = 0;
    peaceGain.connect(masterGain);

    const padFreqs = [110, 164.81, 220, 329.63]; // A2, E3, A3, E4
    padFreqs.forEach((f, i) => {
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.value = 0.08;
      // slow tremolo
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.15 + i * 0.05;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 0.03;
      lfo.connect(lfoGain);
      lfoGain.connect(g.gain);
      o.connect(g);
      g.connect(peaceGain);
      o.start();
      lfo.start();
    });

    // gentle air noise
    const airBuf = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const airData = airBuf.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) airData[i] = (Math.random() * 2 - 1) * 0.5;
    const air = ctx.createBufferSource();
    air.buffer = airBuf;
    air.loop = true;
    const airFilter = ctx.createBiquadFilter();
    airFilter.type = "lowpass";
    airFilter.frequency.value = 800;
    const airGain = ctx.createGain();
    airGain.gain.value = 0.06;
    air.connect(airFilter);
    airFilter.connect(airGain);
    airGain.connect(peaceGain);
    air.start();

    audioRef.current = {
      ctx,
      chaosGain,
      peaceGain,
      masterGain,
      nodes: [noise, rumble, rumbleLfo, horn, air],
    };

    // Tag the timer for cleanup via closure on unmount
    (audioRef.current as unknown as { hornTimer: number }).hornTimer = hornTimer;

    return audioRef.current;
  };

  // Master on/off
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const t = a.ctx.currentTime;
    a.masterGain.gain.cancelScheduledValues(t);
    a.masterGain.gain.linearRampToValueAtTime(soundOn ? 0.6 : 0, t + 0.4);
  }, [soundOn]);

  // Crossfade between chaos and peace based on state
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const t = a.ctx.currentTime;
    const chaos = currentState === 3 ? 0 : currentState === 2 ? 1.0 : 0.7;
    const peace = currentState === 3 ? 1.0 : currentState === 2 ? 0.25 : 0.45;
    a.chaosGain.gain.cancelScheduledValues(t);
    a.peaceGain.gain.cancelScheduledValues(t);
    a.chaosGain.gain.linearRampToValueAtTime(chaos, t + 1.0);
    a.peaceGain.gain.linearRampToValueAtTime(peace, t + 1.0);
  }, [currentState, soundOn]);

  useEffect(() => {
    return () => {
      const a = audioRef.current;
      if (!a) return;
      const timer = (a as unknown as { hornTimer?: number }).hornTimer;
      if (timer) window.clearInterval(timer);
      a.ctx.close().catch(() => {});
      audioRef.current = null;
    };
  }, []);

  const toggleSound = () => {
    const a = ensureAudio();
    if (a.ctx.state === "suspended") a.ctx.resume();
    // Trigger the state-dependent gains for the first time
    const t = a.ctx.currentTime;
    const chaos = currentState === 3 ? 0 : currentState === 2 ? 1.0 : 0.7;
    const peace = currentState === 3 ? 1.0 : currentState === 2 ? 0.25 : 0.45;
    a.chaosGain.gain.setValueAtTime(chaos, t);
    a.peaceGain.gain.setValueAtTime(peace, t);
    setSoundOn((v) => {
      const next = !v;
      if (leftVideoRef.current) {
        leftVideoRef.current.muted = !next;
        if (next) leftVideoRef.current.play().catch(() => {});
      }
      return next;
    });
  };

  return (
    <div
      style={{
        position: "relative",
        width: "100vw",
        height: "100vh",
        background: "#000",
        overflow: "hidden",
        WebkitFontSmoothing: "antialiased",
        fontFamily:
          '"DM Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <style>{`
        @keyframes sv-wave-chaos {
          0%, 100% { transform: translateX(0) scaleY(1); }
          25% { transform: translateX(-8px) scaleY(1.4); }
          50% { transform: translateX(6px) scaleY(0.7); }
          75% { transform: translateX(-4px) scaleY(1.2); }
        }
        @keyframes sv-wave-calm {
          0%, 100% { transform: translateX(0) scaleY(1); }
          50% { transform: translateX(-6px) scaleY(1.05); }
        }
        @keyframes sv-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(0, 212, 170, 0.7); }
          50% { box-shadow: 0 0 0 10px rgba(0, 212, 170, 0); }
        }
        @keyframes sv-pop-in {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes sv-fade-up {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes sv-fade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes sv-breath {
          0%, 100% { filter: drop-shadow(0 0 4px rgba(0,212,170,0.4)); opacity: 0.6; }
          50% { filter: drop-shadow(0 0 18px rgba(0,212,170,0.9)); opacity: 1; }
        }
        .sv-pulse-dot {
          animation: sv-pulse 1.6s ease-out infinite;
        }
        .sv-popup {
          animation: sv-pop-in 0.6s ease-out 0.4s both;
          transition: transform 0.3s ease;
        }
        .sv-popup:hover { transform: scale(1.03); }
        .sv-headline { animation: sv-fade-up 0.9s ease-out 0.5s both; }
        .sv-subhead { animation: sv-fade-up 0.9s ease-out 0.9s both; }
        .sv-logo { animation: sv-fade 0.8s ease-out 1.2s both; }
        .sv-cta { animation: sv-fade-up 0.9s ease-out 1.4s both; }
        .sv-bottom-wave { animation: sv-breath 3s ease-in-out infinite; }
        .sv-cta-primary:hover { filter: brightness(1.1); }
        .sv-cta-ghost { transition: all 0.25s ease; }
        .sv-cta-ghost:hover { background: #fff; color: #0A1420; }
        @keyframes sv-eq {
          0%, 100% { transform: scaleY(0.4); }
          50% { transform: scaleY(1); }
        }
      `}</style>



      {/* LEFT PANEL — Chaos */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          height: "100%",
          width: `${leftWidth}%`,
          overflow: "hidden",
          willChange: "width",
          transition:
            currentState === 3
              ? "width 1.0s cubic-bezier(0.22, 1, 0.36, 1)"
              : "width 1.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
          backgroundImage: `url('${TRAFFIC_IMG}')`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <video
          ref={leftVideoRef}
          src={LEFT_VIDEO}
          autoPlay
          muted
          loop
          playsInline
          poster={TRAFFIC_IMG}
          preload="auto"
          onClick={() => {
            if (leftVideoRef.current) {
              leftVideoRef.current.muted = false;
              leftVideoRef.current.play().catch(() => {});
            }
          }}
          onError={(e) => console.error("Left video error:", e)}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            filter: "grayscale(30%) brightness(0.85) contrast(1.05)",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(0,0,0,0.15)",
          }}
        />
        {/* Label */}
        <div
          style={{
            position: "absolute",
            top: 24,
            left: 24,
            display: "flex",
            alignItems: "center",
            gap: 8,
            color: "#fff",
            fontSize: 12,
            letterSpacing: 3,
            textTransform: "uppercase",
            fontWeight: 500,
            zIndex: 3,
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "#FF4444",
              boxShadow: "0 0 8px #FF4444",
            }}
          />
          Noise
        </div>

        {/* Sound waves */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "opacity 0.5s ease",
            opacity: currentState === 3 ? 0 : 1,
          }}
        >
          <SoundWave
            count={7}
            amplitude={currentState === 2 ? 60 : 40}
            speed={0.9}
            color="#FF4444"
            opacity={0.75}
            width={900}
            height={420}
            chaotic
          />
        </div>

        {/* Popup card */}
        {currentState === 2 && popupVisible && (
          <button
            onClick={goState3}
            className="sv-popup"
            style={{
              position: "absolute",
              right: 24,
              bottom: 24,
              width: 240,
              padding: 0,
              background: "rgba(10, 20, 30, 0.88)",
              border: "1px solid #00D4AA",
              borderRadius: 14,
              overflow: "hidden",
              cursor: "pointer",
              textAlign: "left",
              zIndex: 5,
              backdropFilter: "blur(6px)",
            }}
          >
            <div
              style={{
                width: "100%",
                height: 110,
                backgroundImage: `url('${ROAD_IMG}')`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                borderTopLeftRadius: 13,
                borderTopRightRadius: 13,
              }}
            />
            <div
              style={{
                padding: "12px 14px 14px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
              }}
            >
              <span style={{ color: "#fff", fontSize: 13, fontWeight: 500 }}>
                Escape the chaos →
              </span>
              <span
                className="sv-pulse-dot"
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: "#00D4AA",
                  flexShrink: 0,
                }}
              />
            </div>
          </button>
        )}
      </div>

      {/* RIGHT PANEL — Syros EV */}
      <div
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          height: "100%",
          width: `${rightWidth}%`,
          overflow: "hidden",
          willChange: "width",
          transition:
            currentState === 3
              ? "width 1.0s cubic-bezier(0.22, 1, 0.36, 1)"
              : "width 1.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
          backgroundImage: `url('${ROAD_IMG}')`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <video
          src={RIGHT_VIDEO}
          autoPlay
          muted
          loop
          playsInline
          poster={ROAD_IMG}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            filter: "hue-rotate(10deg) saturate(1.2) brightness(1.05)",
          }}
        />
        {/* Label (hidden in state 3) */}
        {currentState !== 3 && (
          <div
            style={{
              position: "absolute",
              top: 24,
              left: 24,
              display: "flex",
              alignItems: "center",
              gap: 8,
              color: "#fff",
              fontSize: 12,
              letterSpacing: 3,
              textTransform: "uppercase",
              fontWeight: 500,
              zIndex: 3,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "#00D4AA",
                boxShadow: "0 0 8px #00D4AA",
              }}
            />
            Syros EV
          </div>
        )}

        {/* Gentle waves */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "opacity 0.5s ease",
            opacity: currentState === 3 ? 0 : 0.5,
          }}
        >
          <SoundWave
            count={4}
            amplitude={14}
            speed={4}
            color="#00D4AA"
            opacity={0.8}
            width={700}
            height={260}
          />
        </div>
      </div>

      {/* Center divider */}
      {currentState !== 3 && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: `${leftWidth}%`,
            transform: "translateX(-1px)",
            width: 2,
            height: "100%",
            background: "#fff",
            zIndex: 4,
            transition:
              "left 1.2s cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 0.4s ease",
            opacity: currentState === 3 ? 0 : 1,
          }}
        />
      )}

      {/* STATE 3 overlay content */}
      {currentState === 3 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 10,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "flex-start",
            paddingTop: "22vh",
            color: "#fff",
          }}
        >
          <div
            className="sv-logo"
            style={{
              position: "absolute",
              top: 28,
              left: 32,
              color: "#fff",
              textTransform: "uppercase",
              letterSpacing: 4,
              fontSize: 16,
              fontWeight: 500,
            }}
          >
            Syros EV
          </div>

          <h1
            className="sv-headline"
            style={{
              fontSize: 48,
              fontWeight: 700,
              letterSpacing: "-0.5px",
              color: "#fff",
              margin: 0,
              textAlign: "center",
              textShadow: "0 2px 24px rgba(0,0,0,0.5)",
            }}
          >
            Less Noise. More Journey.
          </h1>
          <p
            className="sv-subhead"
            style={{
              fontSize: 22,
              fontWeight: 300,
              letterSpacing: "0.5px",
              color: "#fff",
              marginTop: 18,
              textAlign: "center",
              textShadow: "0 2px 18px rgba(0,0,0,0.5)",
            }}
          >
            The Silent Power of Syros EV.
          </p>

          <div
            className="sv-cta"
            style={{
              marginTop: 40,
              display: "flex",
              alignItems: "center",
              gap: 18,
            }}
          >
            <button
              className="sv-cta-primary"
              style={{
                background: "#00D4AA",
                color: "#0A1420",
                border: "none",
                borderRadius: 999,
                padding: "14px 32px",
                fontWeight: 600,
                fontSize: 15,
                cursor: "pointer",
                transition: "filter 0.2s ease",
              }}
            >
              Discover Syros EV
            </button>
            <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 18 }}>
              |
            </span>
            <button
              className="sv-cta-ghost"
              style={{
                background: "transparent",
                color: "#fff",
                border: "1px solid #fff",
                borderRadius: 999,
                padding: "14px 32px",
                fontWeight: 600,
                fontSize: 15,
                cursor: "pointer",
              }}
            >
              Watch Full Story
            </button>
          </div>

          {/* Bottom peaceful wave */}
          <div
            className="sv-bottom-wave"
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: "10%",
              display: "flex",
              justifyContent: "center",
              animation: "sv-fade 1.2s ease-out 1s both, sv-breath 3s ease-in-out 1s infinite",
            }}
          >
            <SoundWave
              count={1}
              amplitude={8}
              speed={6}
              color="#00D4AA"
              opacity={0.9}
              width={Math.min(1200, typeof window !== "undefined" ? window.innerWidth * 0.7 : 900)}
              height={60}
            />
          </div>
        </div>
      )}
    </div>
  );
}

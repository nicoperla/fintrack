/*
 * Real screenshots and recordings of the app (demo account), made by
 * scripts/capture-landing-media.mjs: re-run it when the UI changes.
 */
import shotDashboard from "@/public/landing/shot-dashboard.jpg";
import shotDashboardLight from "@/public/landing/shot-dashboard-light.jpg";
import shotRitrovati from "@/public/landing/shot-ritrovati.jpg";
import shotCoach from "@/public/landing/shot-coach.jpg";
import shotAfford from "@/public/landing/shot-afford.jpg";
import shotForecast from "@/public/landing/shot-forecast.jpg";
import shotInsights from "@/public/landing/shot-insights.jpg";
import shotSplit from "@/public/landing/shot-split.jpg";
import mobileDashboard from "@/public/landing/mobile-dashboard.jpg";
import mobileQuick from "@/public/landing/mobile-quick.jpg";
import mobileRitrovati from "@/public/landing/mobile-ritrovati.jpg";
import mobileCoach from "@/public/landing/mobile-coach.jpg";
import mobileStories from "@/public/landing/mobile-stories.jpg";

export const SHOTS = {
  dashboard: shotDashboard,
  dashboardLight: shotDashboardLight,
  ritrovati: shotRitrovati,
  coach: shotCoach,
  afford: shotAfford,
  forecast: shotForecast,
  insights: shotInsights,
  split: shotSplit,
  mobileDashboard,
  mobileQuick,
  mobileRitrovati,
  mobileCoach,
  mobileStories,
};

export const VIDEOS = {
  desktop: {
    src: "/landing/video-desktop.mp4",
    poster: "/landing/video-desktop-poster.jpg",
    seconds: 32,
    /** Where each part starts, for the chapter buttons. */
    chapters: [
      { at: 0, label: "Dashboard e inserimento rapido" },
      { at: 8.5, label: "Soldi ritrovati" },
      { at: 14.5, label: "Coach e «Posso permettermelo?»" },
      { at: 22.5, label: "Il mese in storie" },
    ],
  },
  mobile: {
    src: "/landing/video-mobile.mp4",
    poster: "/landing/video-mobile-poster.jpg",
  },
};

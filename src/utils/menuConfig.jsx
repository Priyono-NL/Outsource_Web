import React, { lazy } from 'react';

// ==========================================
// 1. LAZY IMPORT SEMUA HALAMAN (CODE SPLITTING)
// Mengurangi ukuran bundle awal secara drastis
// ==========================================
const Dashboard = lazy(() => import('../pages/Dashboard'));
const RolePermission = lazy(() => import('../pages/RolePermission'));
const ChangeLogin = lazy(() => import('../pages/ChangeLogin'));
const Employement = lazy(() => import('../pages/Employment'));
const OsCard = lazy(() => import('../pages/OsCard'));
const OsCC = lazy(() => import('../pages/OsCC'));
const OsGrade = lazy(() => import('../pages/OsGrade'));
const Blacklist = lazy(() => import('../pages/Blacklist'));
const Biodata = lazy(() => import('../pages/Biodata'));
const OsType = lazy(() => import('../pages/OsType'));
const Alokasi = lazy(() => import('../pages/Alokasi'));
const OsMedical = lazy(() => import('../pages/OsMedical'));
const OsTraining = lazy(() => import('../pages/OsTraining'));
const Canteen = lazy(() => import('../pages/Canteen'));
const CostCenter = lazy(() => import('../pages/CostCenter'));
const SubCompany = lazy(() => import('../pages/SubCompany'));
const Training_m = lazy(() => import('../pages/Training_m'));
const Medical_m = lazy(() => import('../pages/Medical_m'));
const Terminal = lazy(() => import('../pages/Terminal'));
const PeriodePuasa = lazy(() => import('../pages/periode_puasa'));
const ObEmployee = lazy(() => import('../pages/ObEmployee'));
const Absensi = lazy(() => import('../pages/Absensi'));
const AbsensiVendor = lazy(() => import('../pages/AbsensiVendor'));
const ReportAktif = lazy(() => import('../pages/ReportAktif'));
const ReportAbsen = lazy(() => import('../pages/ReportAbsen'));
const Report_MPCC = lazy(() => import('../pages/Report_MPCC'));
const Report_Absen = lazy(() => import('../pages/Report_Absen'));
const Report_MpEmp = lazy(() => import('../pages/Report_MpEmp'));
const Report_Break = lazy(() => import('../pages/Report_Break'));
const Report_Access = lazy(() => import('../pages/Report_Access'));
const ReportAbsenVendor = lazy(() => import('../pages/ReportAbsenVendor'));
const Guest = lazy(() => import('../pages/Guest'));

// Import Halaman Khusus SSO & Approval
const AuthCallback = lazy(() => import('../pages/AuthCallback'));
const UserManagement = lazy(() => import('../pages/UserManagement'));

// ==========================================
// 2. COMPONENT REGISTRY (PETA ROUTE DINAMIS)
// ==========================================
// Key (sebelah kiri) HARUS sama persis dengan kolom 'path' di tabel hr_app_menus MySQL.
export const componentRegistry = {
  // --- Core Pages ---
  '/': <Dashboard />,
  '/biodata': <Biodata />,
  '/employment': <ObEmployee />,

  // --- Master OS ---
  '/osemployment': <Employement />,
  '/card': <OsCard />,
  '/oscc': <OsCC />,
  '/grade': <OsGrade />,
  '/type': <OsType />,
  '/blacklist': <Blacklist />,

  // --- Transaksional ---
  '/alokasi': <Alokasi />,
  '/os-medical': <OsMedical />,
  '/os-training': <OsTraining />,
  '/bac-os': <Absensi />,
  '/guest': <Guest />,

  // --- Report ---
  '/os-active': <ReportAktif />,
  '/absensi': <ReportAbsen />,
  '/reportHarian': <Report_Absen />,
  '/reportMpCc': <Report_MPCC />,
  '/reportMpEmp': <Report_MpEmp />,
  '/reportBreak': <Report_Break />,
  '/reportAccess': <Report_Access />,

  // --- Master Data ---
  '/costcenter': <CostCenter />,
  '/canteen': <Canteen />,
  '/sub-company': <SubCompany />,
  '/training-m': <Training_m />,
  '/medical-m': <Medical_m />,
  '/terminal': <Terminal />,
  '/periode': <PeriodePuasa />,

  // --- Vendor / Kontraktor ---
  '/absenVendor': <AbsensiVendor />,
  '/ReportAbsenVendor': <ReportAbsenVendor />,

  // --- Administration Pages ---
  '/role-permission': <RolePermission />,
  '/change-login': <ChangeLogin />,

  // --- System & Auth Routes ---
  '/auth/callback': <AuthCallback />,
  '/user-access': <UserManagement />,
};
import React from 'react';

// ==========================================
// 1. IMPORT SEMUA HALAMAN (PAGES)
// ==========================================
import Dashboard from '../pages/Dashboard';
import RolePermission from '../pages/RolePermission';
import ChangeLogin from '../pages/ChangeLogin';
import Employement from '../pages/Employment';
import OsCard from '../pages/OsCard';
import OsCC from '../pages/OsCC';
import OsGrade from '../pages/OsGrade';
import Blacklist from '../pages/Blacklist';
import Biodata from '../pages/Biodata';
import OsType from '../pages/OsType';
import Alokasi from '../pages/Alokasi';
import OsMedical from '../pages/OsMedical';
import OsTraining from '../pages/OsTraining';
import Canteen from '../pages/Canteen';
import CostCenter from '../pages/CostCenter';
import SubCompany from '../pages/SubCompany';
import Training_m from '../pages/Training_m';
import Medical_m from '../pages/Medical_m';
import Terminal from '../pages/Terminal';
import PeriodePuasa from '../pages/periode_puasa';
import ObEmployee from '../pages/ObEmployee';
import Absensi from '../pages/Absensi';
import AbsensiVendor from '../pages/AbsensiVendor';
import ReportAktif from '../pages/ReportAktif';
import ReportAbsen from '../pages/ReportAbsen';
import Report_MPCC from '../pages/Report_MPCC';
import Report_Absen from '../pages/Report_Absen';
import Report_MpEmp from '../pages/Report_MpEmp';
import Report_Break from '../pages/Report_Break';
import Report_Access from '../pages/Report_Access';
import ReportAbsenVendor from '../pages/ReportAbsenVendor';

// Import Halaman Khusus SSO & Approval
import AuthCallback from '../pages/AuthCallback';
import PendingApproval from '../pages/PendingApproval';

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
  '/pending-approval': <PendingApproval />
};
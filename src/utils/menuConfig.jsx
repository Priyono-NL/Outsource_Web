import React from 'react';

import Dashboard from '../pages/Dashboard';
import Alokasi from '../pages/Alokasi';
import OsMedical from '../pages/OsMedical';
import OsTraining from '../pages/OsTraining';
import CostCenter from '../pages/CostCenter';
import SubCompany from '../pages/SubCompany';
import Training_m from '../pages/Training_m';
import Medical_m from '../pages/Medical_m';
import Canteen from '../pages/Canteen';
import OsCard from '../pages/OsCard';
import OsCC from '../pages/OsCC';
import OsGrade from '../pages/OsGrade';
import Blacklist from '../pages/Blacklist';
import Biodata from '../pages/Biodata';
import Employement from '../pages/Employment';
import OsType from '../pages/OsType';

import RolePermission from '../pages/RolePermission';
import ChangeLogin from '../pages/ChangeLogin';

import Absensi from '../pages/Absensi';
import Violation from '../pages/Violation';

export const routesConfig = [  
  { path: '/', label: 'Dashboard', icon: 'bi-speedometer2', element: <Dashboard />, group: 0 },

  {
    label: 'Absensi OS',
    icon: 'bi-card-checklist',
    group: 1,
    children: [
      { path: '/absensi', label: 'Absensi', icon: 'bi-calendar-check-fill', element: <Absensi /> },
      { path: '/violation', label: 'Absensi Violation', icon: 'bi-calendar2-x-fill', element: <Violation />}
    ]
  },

  {
    label: 'Master OS',
    icon: 'bi-person',
    group: 2,
    children: [
      { path: '/employment', label: 'Employment', icon: 'bi-person-badge', element: <Employement /> },
      { path: '/alokasi', label: 'Alokasi Kantin', icon: 'bi-grid-3x3-gap', element: <Alokasi /> },
      { path: '/card', label: 'Absence Card', icon: 'bi-credit-card', element: <OsCard /> },
      { path: '/oscc', label: 'Department', icon: 'bi-diagram-3', element: <OsCC /> },
      { path: '/grade', label: 'Grade', icon: 'bi-bar-chart', element: <OsGrade /> }, 
      { path: "/type", label: "Type Work", icon: "bi-minecart", element: <OsType /> },
      { path: '/blacklist', label: 'Blacklist', icon: 'bi-slash-circle', element: <Blacklist /> },
      { path: '/os-medical', label: 'Medical', icon: 'bi-heart-pulse', element: <OsMedical /> },
      { path: '/os-training', label: 'Training', icon: 'bi-mortarboard', element: <OsTraining /> },
    ]
  },

  {
    label: 'Master Data',
    icon: 'bi-database-fill-gear',
    group: 3,
    children: [
      { path: "/costcenter", label: "Master Cost Center", icon: "bi-cash-stack", element: <CostCenter /> },
      { path: "/canteen", label: "Master Kantin", icon: "bi-cup-hot", element: <Canteen /> },
      { path: "/sub-company", label: "Master Sub Company", icon: "bi-building", element: <SubCompany /> },
      { path: "/training-m", label: "Master Training", icon: "bi-book", element: <Training_m /> },
      { path: "/medical-m", label: "Master Medical", icon: "bi-hospital", element: <Medical_m /> },      
      
    ]
  },
];

// Route khusus admin — tidak ikut permission system (selalu tampil untuk admin+)
export const adminRoutes = [];

// export const adminRoutes = [
//   {
//     path: '/role-permission',
//     label: 'Hak Akses',
//     icon: 'bi-shield-lock',
//     element: <RolePermission />,
//     roles: ['admin', 'superadmin'],  // admin & superadmin bisa akses
//   },
//   {
//     path: '/change-login',
//     label: 'Change Login As',
//     icon: 'bi-person-video3',
//     element: <ChangeLogin />,
//     roles: ['superadmin'],
//   },
// ];
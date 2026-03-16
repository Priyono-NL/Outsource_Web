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

export const routesConfig = [
  // Group 0: Dashboard
  { path: "/", label: "Dashboard", element: <Dashboard />, group: 0 },  
  // Group 1
  { path: "/biodata", label:"Biodata", element: <Biodata />, group: 1 }, 
  { path: "/alokasi", label: "Alokasi Kantin", element: <Alokasi />, group: 1 },  
  { path: "/card", label: "Absence Card", element: <OsCard />, group: 1 },
  { path: "/oscc", label: "Department", element: <OsCC />, group: 1 },
  { path: "/grade", label: "Grade", element: <OsGrade />, group: 1 },
  { path: "/blacklist", label: "Blacklist", element: <Blacklist />, group: 1 },  
  // Group 2
  { path: "/os-medical", label: "Medical", element: <OsMedical />, group: 2 },
  { path: "/os-training", label: "Training", element: <OsTraining />, group: 2 },
  // Group 3
  { path: "/sub-company", label: "Sub Company", element: <SubCompany />, group: 3 },
  { path: "/training-m", label: "Training", element: <Training_m />, group: 3 },
  { path: "/medical-m", label: "Medical", element: <Medical_m />, group: 3 },
  { path: "/canteen", label: "Kantin", element: <Canteen />, group: 3 },
  { path: "/costcenter", label: "Cost Center", element: <CostCenter />, group: 3 },
];
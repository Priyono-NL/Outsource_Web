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

export const routesConfig = [
  // Group 0: 
  { path: "/", label: "Dashboard", icon: "bi-speedometer2", element: <Dashboard />, group: 0 }, 
  // Group 1: Employement
  { path: "/employment", label:"Employement",icon: "bi-person-badge", element: <Employement />, group: 1 }, 
  { path: "/biodata", label:"Biodata", icon: "bi-person-lines-fill", element: <Biodata />, group: 1 }, 
  { path: "/alokasi", label: "Alokasi Kantin", icon: "bi-grid-3x3-gap", element: <Alokasi />, group: 1 },  
  { path: "/card", label: "Absence Card", icon: "bi-credit-card", element: <OsCard />, group: 1 },
  { path: "/oscc", label: "Department", icon: "bi-diagram-3", element: <OsCC />, group: 1 },
  { path: "/grade", label: "Grade", icon: "bi-bar-chart", element: <OsGrade />, group: 1 },
  { path: "/type", label: "Type Work", icon: "bi-bar-chart", element: <OsType />, group: 1 },
  { path: "/blacklist", label: "Blacklist", icon: "bi-slash-circle", element: <Blacklist />, group: 1 },  
  // Group 2
  { path: "/os-medical", label: "Medical", icon: "bi-heart-pulse", element: <OsMedical />, group: 2 },
  { path: "/os-training", label: "Training", icon: "bi-mortarboard", element: <OsTraining />, group: 2 },
  // Group 3
  { path: "/sub-company", label: "Master Sub Company", icon: "bi-building", element: <SubCompany />, group: 3 },
  { path: "/training-m", label: "Master Training", icon: "bi-book", element: <Training_m />, group: 3 },
  { path: "/medical-m", label: "Master Medical", icon: "bi-hospital", element: <Medical_m />, group: 3 },
  { path: "/canteen", label: "Master Kantin", icon: "bi-cup-hot", element: <Canteen />, group: 3 },
  { path: "/costcenter", label: "Master Cost Center", icon: "bi-cash-stack", element: <CostCenter />, group: 3 },
];
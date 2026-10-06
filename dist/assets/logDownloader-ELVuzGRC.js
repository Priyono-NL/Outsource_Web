const d=(a=[],o=[])=>{let e=`=========================================
`;e+=`       HASIL UPLOAD LOG REPORT
`,e+="       Tanggal: "+new Date().toLocaleString()+`
`,e+=`=========================================

`,a.length>0&&(e+=`--- DAFTAR ERROR (GAGAL DIPROSES) ---
`,a.forEach(t=>{e+=`${t}
`}),e+=`
`),o.length>0&&(e+=`--- CATATAN SISTEM (PENYESUAIAN DATA) ---
`,o.forEach(t=>{e+=`${t}
`}),e+=`
`),e+=`=========================================
`,e+=`Silakan perbaiki baris yang error pada file Excel Anda lalu upload kembali.
`;const c=new Blob([e],{type:"text/plain;charset=utf-8"}),l=URL.createObjectURL(c),n=document.createElement("a");n.href=l,n.setAttribute("download",`Upload_Log_${new Date().getTime()}.txt`),document.body.appendChild(n),n.click(),document.body.removeChild(n),window.URL.revokeObjectURL(l)};export{d};

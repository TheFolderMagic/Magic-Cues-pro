// Helper: convert a Blob to base64 string
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Global exportShow function that index.html will call
window.exportShow = async () => {
  let p = projectsList.find(x => x.id === editProjId);
  if (!p) return;

  // Read the show data from IndexedDB
  const tx = db.transaction('store', 'readonly');
  const store = tx.objectStore('store');
  const data = await new Promise((resolve, reject) => {
    const req = store.get('proj_' + p.id);
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });

  if (!data.length) {
    showAlert('Notice', 'No cues to export.');
    return;
  }

  document.getElementById('edit-show-name').value = 'Exporting...';

  // Convert tracks to export format (blobs → base64)
  let ex = [];
  for (let t of data) {
    if (t.isExternalShow) {
      let se = [];
      for (let st of t.showData) {
        if (st.file) {
          let b64 = await blobToBase64(st.file);
          se.push({ ...st, fileData: b64, file: undefined });
        } else {
          se.push({ ...st });
        }
      }
      ex.push({ ...t, showData: se });
    } else if (t.file) {
      let b64 = await blobToBase64(t.file);
      ex.push({ ...t, fileData: b64, file: undefined });
    } else {
      ex.push({ ...t });
    }
  }

  const jsonString = JSON.stringify(ex);
  const fileName = p.name + '.magic';

  // Check if running in custom Android App with Javascript Interface (window.Android)
  if (window.Android && typeof window.Android.startFileWrite === 'function') {
    try {
      // Convert JSON to Base64 safely (handling UTF-8 characters)
      let base64Data = btoa(unescape(encodeURIComponent(jsonString)));
      
      const CHUNK_SIZE = 512 * 1024; // 512 KB chunks to prevent WebView heap memory issues
      window.Android.startFileWrite(fileName);
      
      for (let i = 0; i < base64Data.length; i += CHUNK_SIZE) {
        let chunk = base64Data.substring(i, i + CHUNK_SIZE);
        window.Android.appendFileChunk(chunk);
      }
      
      window.Android.endFileWrite();
      showAlert("Exported", "Show exported directly to Downloads folder!");
    } catch (e) {
      showAlert("Error", "Native export failed: " + e.message);
    }
  } else {
    // Fallback for standard web browsers
    let a = document.createElement('a'); 
    a.href = URL.createObjectURL(new Blob([jsonString], {type: 'application/json'})); 
    a.download = fileName; 
    document.body.appendChild(a);
    a.click(); 
    document.body.removeChild(a);
  }

  document.getElementById('edit-show-name').value = p.name;
};

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
  // Accessed directly as standard declarative global variables (no window. prefix)
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
  const fileName = p.name + '.magic';

  // Helper function to send a string in tiny, safe chunks to prevent memory overhead
  const sendInChunks = (str) => {
    const CHUNK_SIZE = 256 * 1024; // 256 KB chunks
    for (let i = 0; i < str.length; i += CHUNK_SIZE) {
      let chunk = str.substring(i, i + CHUNK_SIZE);
      window.Android.appendFileChunk(chunk);
    }
  };

  // Check if running in custom Android App with Javascript Interface (window.Android)
  if (window.Android && typeof window.Android.startFileWrite === 'function') {
    try {
      window.Android.startFileWrite(fileName);
      
      // Open JSON array structure
      window.Android.appendFileChunk("[");

      for (let i = 0; i < data.length; i++) {
        let t = data[i];
        let t_export = {};

        // Process a single track
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
          t_export = { ...t, showData: se };
        } else if (t.file) {
          let b64 = await blobToBase64(t.file);
          t_export = { ...t, fileData: b64, file: undefined };
        } else {
          t_export = { ...t };
        }

        // Convert only this single track to JSON string
        let cueStr = JSON.stringify(t_export);
        
        // Add comma separator if not the first item
        if (i > 0) {
          window.Android.appendFileChunk(",");
        }

        // Send this track's JSON chunk by chunk
        sendInChunks(cueStr);

        // Explicitly clear memory of this track immediately for garbage collection
        t_export = null;
        cueStr = null;
      }

      // Close JSON array structure
      window.Android.appendFileChunk("]");
      window.Android.endFileWrite();
      
      showAlert("Exported", "Show exported directly to Downloads folder!");
    } catch (e) {
      showAlert("Error", "Native export failed: " + e.message);
    }
  } else {
    // Fallback for standard web browsers (also built as a memory-efficient stream)
    try {
      let chunks = ["["];
      for (let i = 0; i < data.length; i++) {
        let t = data[i];
        let t_export = {};
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
          t_export = { ...t, showData: se };
        } else if (t.file) {
          let b64 = await blobToBase64(t.file);
          t_export = { ...t, fileData: b64, file: undefined };
        } else {
          t_export = { ...t };
        }
        if (i > 0) chunks.push(",");
        chunks.push(JSON.stringify(t_export));
      }
      chunks.push("]");
      
      let a = document.createElement('a'); 
      a.href = URL.createObjectURL(new Blob(chunks, {type: 'application/json'})); 
      a.download = fileName; 
      document.body.appendChild(a);
      a.click(); 
      document.body.removeChild(a);
    } catch (e) {
      showAlert("Error", "Browser export failed: " + e.message);
    }
  }

  document.getElementById('edit-show-name').value = p.name;
};

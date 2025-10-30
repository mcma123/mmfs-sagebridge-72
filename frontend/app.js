// Sample hierarchy data for prototype
const sample = {
  name: 'MMFS', type: 'company', children: [
    { name: 'Countries', type: 'generic', children: [
      { name: 'Zimbabwe', type: 'country', children: [
        { name: 'Cedants', type: 'generic', children: [
          { name: 'ABC Insurance', type: 'cedant', children: [
            { name: 'Facultative', type: 'category', children: [] },
            { name: 'Treaty', type: 'category', children: [
              { name: 'Quotations', type: 'treaty_section', children: [] },
              { name: 'Placements', type: 'treaty_section', children: [] },
              { name: 'Masters', type: 'treaty_section', children: [] },
            ]},
          ]},
          { name: 'XYZ Insurance', type: 'cedant', children: [] },
        ]},
      ]},
      { name: 'Botswana', type: 'country', children: [] },
      { name: 'Mozambique', type: 'country', children: [] },
    ]}
  ]
};

let currentPath = [sample];

function renderBreadcrumb() {
  const el = document.getElementById('breadcrumb');
  el.innerHTML = '';
  currentPath.forEach((node, idx) => {
    const span = document.createElement('span');
    span.className = 'crumb';
    span.textContent = node.name;
    span.onclick = () => {
      currentPath = currentPath.slice(0, idx + 1);
      renderAll();
    };
    el.appendChild(span);
  });
}

function renderTree() {
  const el = document.getElementById('tree');
  el.innerHTML = '';
  function nodeToElement(node, depth = 0) {
    const div = document.createElement('div');
    div.style.paddingLeft = depth * 12 + 'px';
    div.className = 'node folder';
    div.textContent = node.name;
    div.onclick = () => {
      currentPath = [...currentPath, node];
      renderAll();
    };
    el.appendChild(div);
    (node.children || []).forEach(child => nodeToElement(child, depth + 1));
  }
  nodeToElement(sample);
}

function renderContent() {
  const el = document.getElementById('content');
  el.innerHTML = '';
  const node = currentPath[currentPath.length - 1];
  const grid = document.createElement('div');
  grid.className = 'grid';
  (node.children || []).forEach(child => {
    const card = document.createElement('div');
    card.className = 'card node ' + (child.children ? 'folder' : 'document');
    card.textContent = child.name + (child.type ? ` (${child.type})` : '');
    card.onclick = () => {
      currentPath = [...currentPath, child];
      renderAll();
    };
    grid.appendChild(card);
  });
  el.appendChild(grid);
}

function renderDetails() {
  const el = document.getElementById('detailsBody');
  const node = currentPath[currentPath.length - 1];
  el.innerHTML = `<strong>Name:</strong> ${node.name}<br/><strong>Type:</strong> ${node.type || 'document'}<br/>`;
}

function renderAll() {
  renderBreadcrumb();
  renderTree();
  renderContent();
  renderDetails();
}

// Toolbar actions (prototype stubs)
document.getElementById('btnNewFolder').onclick = () => {
  const name = prompt('New folder name:');
  if (!name) return;
  const node = currentPath[currentPath.length - 1];
  node.children = node.children || [];
  node.children.push({ name, type: 'generic', children: [] });
  renderAll();
};

document.getElementById('btnUpload').onclick = () => {
  const input = document.getElementById('fileInput');
  input.onchange = () => {
    alert(`${input.files.length} file(s) selected (simulated upload).`);
    input.value = '';
  };
  input.click();
};

document.getElementById('btnRename').onclick = () => {
  const node = currentPath[currentPath.length - 1];
  const name = prompt('Rename to:', node.name);
  if (name) {
    node.name = name;
    currentPath[currentPath.length - 1] = node;
    renderAll();
  }
};

document.getElementById('btnMove').onclick = () => {
  alert('Move action would present a destination picker (prototype).');
};

document.getElementById('btnDelete').onclick = () => {
  const parent = currentPath[currentPath.length - 2];
  const node = currentPath[currentPath.length - 1];
  if (!parent) return alert('Cannot delete root.');
  parent.children = (parent.children || []).filter(c => c !== node);
  currentPath = currentPath.slice(0, -1);
  renderAll();
};

document.getElementById('btnShare').onclick = () => {
  alert('Share would create a signed link with expiry (prototype).');
};

// Initialize
renderAll();
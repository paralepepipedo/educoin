// ============================================
// ARCHIVO: admin_pruebas.js  — VERSIÓN: v3.2
// Changelog:
//   v3.2 - Botón Forzar/Desforzar prueba activa (toggle_forzada)
//   v3.1 - Link 🔗 usa BASE_URL para funcionar en local y producción
//   v3.0 - Fix botón Editar prueba (renderUnidadesDisponibles antes del setTimeout)
//        - Botón Borrar prueba activa (eliminar_prueba_activa)
//        - Almacén con sub-carpetas por fila/fuente (get_banco_filas)
//        - Borrar lote completo de preguntas (eliminar_fila_banco)
//        - Previsualización de evaluación activa (modal)
//   v2.0 - Editor visual de preguntas, fix scope globals, borrarPregunta
// ============================================

(function () {
  'use strict';

  let estadisticasBanco = [];
  let filasDetalleBanco = [];
  window._listaPruebasGlobal = [];
  window._editandoPruebaId = null;

  document.addEventListener('DOMContentLoaded', function () {
    initShared('admin');
    initTabsLocales();
    document.getElementById('btnGuardarBanco').addEventListener('click', guardarBancoPreguntas);
    document.getElementById('fPruebaGrado').addEventListener('change', renderUnidadesDisponibles);
    document.getElementById('fPruebaAsig').addEventListener('change', renderUnidadesDisponibles);
    document.getElementById('btnActivarPrueba').addEventListener('click', activarPrueba);
  });

  document.addEventListener('clerkReady', function () {
    var nombreEl = document.getElementById('adminNombre');
    if (nombreEl && window.CLERK_USER) {
      nombreEl.textContent = window.CLERK_USER.firstName || window.CLERK_USER.username || 'Admin';
    }
    cargarEstadoAlmacen();
    cargarPruebasActivas();
  });

  // ==========================================
  // TABS
  // ==========================================
  function initTabsLocales() {
    document.querySelectorAll('.admin-tab').forEach(function (btn) {
      if (btn.tagName.toLowerCase() === 'a' || btn.onclick) return;
      btn.addEventListener('click', function () {
        document.querySelectorAll('.admin-tab[data-tab]').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        var panel = document.getElementById('tab-' + btn.dataset.tab);
        if (panel) panel.classList.add('active');
      });
    });
  }

  // ==========================================
  // TAB 1: ALMACÉN
  // ==========================================
  function guardarBancoPreguntas() {
    var grado = document.getElementById('fBancoGrado').value;
    var asig = document.getElementById('fBancoAsig').value;
    var unidad = document.getElementById('fBancoUnidad').value;
    var tema = document.getElementById('fBancoTema').value.trim();
    var jsonText = document.getElementById('fBancoJson').value.trim();

    if (!unidad || !jsonText) return toast('⚠️ Falta la Unidad o pegar el JSON', 'warning');

    var preguntasArr = [];
    try {
      preguntasArr = JSON.parse(jsonText);
      if (!Array.isArray(preguntasArr)) throw new Error('Debe ser un arreglo []');
    } catch (e) { return toast('❌ Error de formato JSON: ' + e.message, 'error'); }

    var btn = document.getElementById('btnGuardarBanco');
    btn.disabled = true; btn.textContent = 'Guardando...';

    apiPost({ action: 'guardar_banco_preguntas', grado: Number(grado), asignatura: asig, unidad: Number(unidad), tema, preguntas: preguntasArr })
      .then(() => {
        toast('✅ Guardadas ' + preguntasArr.length + ' preguntas', 'success');
        document.getElementById('fBancoJson').value = '';
        document.getElementById('fBancoTema').value = '';
        cargarEstadoAlmacen();
      })
      .catch(e => toast('❌ ' + e.message, 'error'))
      .finally(() => { btn.disabled = false; btn.textContent = '💾 Guardar en el Almacén'; });
  }

  function cargarEstadoAlmacen() {
    Promise.all([
      apiPost({ action: 'get_banco_stats' }),
      apiPost({ action: 'get_banco_filas' })
    ]).then(([resStats, resFilas]) => {
      estadisticasBanco = resStats.stats || [];
      filasDetalleBanco = resFilas.filas || [];
      renderEstadoAlmacen();
      renderUnidadesDisponibles();
    }).catch(e => console.error(e));
  }

  function renderEstadoAlmacen() {
    const div = document.getElementById('almacenStats');
    if (filasDetalleBanco.length === 0) {
      div.innerHTML = 'El almacén está vacío.'; return;
    }

    // Agrupar: asignatura → grado_unidad → filas individuales
    let agrupado = {};
    filasDetalleBanco.forEach(f => {
      if (!agrupado[f.asignatura]) agrupado[f.asignatura] = {};
      const clave = `${f.grado}_${f.unidad}`;
      if (!agrupado[f.asignatura][clave]) agrupado[f.asignatura][clave] = { grado: f.grado, unidad: f.unidad, filas: [] };
      agrupado[f.asignatura][clave].filas.push(f);
    });

    let html = '';
    for (let asig in agrupado) {
      const unidades = agrupado[asig];
      let totalAsig = 0;
      for (let u in unidades) unidades[u].filas.forEach(f => totalAsig += f.total_preguntas);

      html += `
        <div style="background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.1); border-radius:8px; margin-bottom:0.5rem;">
          <div onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display === 'none' ? 'block' : 'none'"
               style="padding:1rem; cursor:pointer; display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.3); border-radius:8px;">
            <strong style="color:var(--text); font-size:1.05rem;">📁 ${asig} <span style="color:#22c55e; font-size:0.8rem; font-weight:normal;">[${totalAsig} preg total]</span></strong>
            <span style="color:var(--text-dim); font-size:0.8rem;">▼ Expandir</span>
          </div>
          <div style="display:none; padding:0.8rem; border-top:1px solid rgba(255,255,255,0.05);">`;

      for (let claveUnidad in unidades) {
        const { grado, unidad, filas } = unidades[claveUnidad];
        const totalUnidad = filas.reduce((s, f) => s + f.total_preguntas, 0);

        html += `
          <div style="background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.07); border-radius:6px; margin-bottom:0.5rem;">
            <div onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display === 'none' ? 'block' : 'none'"
                 style="padding:0.7rem 1rem; cursor:pointer; display:flex; justify-content:space-between; align-items:center;">
              <span style="color:var(--primary); font-weight:800; font-size:0.9rem;">📂 Unidad ${unidad} (Grado ${grado}°) <span style="color:#22c55e;">[${totalUnidad} preg]</span></span>
              <span style="color:var(--text-dim); font-size:0.75rem;">▼</span>
            </div>
            <div style="display:none; padding:0.5rem 0.8rem; border-top:1px solid rgba(255,255,255,0.05);">`;

        filas.forEach(f => {
          const fechaStr = f.created_at ? new Date(f.created_at).toLocaleDateString('es-CL') : '';
          const temaLabel = f.tema ? f.tema : 'Sin tema';
          html += `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:0.5rem 0.7rem; background:rgba(0,0,0,0.2); border-left:3px solid rgba(99,102,241,0.4); border-radius:4px; margin-bottom:0.35rem; flex-wrap:wrap; gap:0.4rem;">
              <div>
                <span style="color:var(--text); font-size:0.82rem; font-weight:700;">📄 ${temaLabel}</span>
                <span style="color:#22c55e; font-size:0.78rem; font-weight:800; margin-left:0.5rem;">[${f.total_preguntas} preg]</span>
                ${fechaStr ? `<span style="color:var(--text-dim); font-size:0.72rem; margin-left:0.4rem;">${fechaStr}</span>` : ''}
              </div>
              <div style="display:flex; gap:0.35rem;">
                <button class="btn-admin btn-sm" onclick="abrirEditor('${f.asignatura}', ${f.grado}, ${f.unidad})"
                        style="background:rgba(59,130,246,0.1); color:#60a5fa; border:none;">👁️ Ver/Editar</button>
                <button class="btn-admin btn-sm" onclick="borrarFilaBanco('${f.id}', '${temaLabel.replace(/'/g, "\\'")}', ${f.total_preguntas})"
                        style="background:rgba(239,68,68,0.1); color:#ef4444; border:1px solid rgba(239,68,68,0.3);">🗑️ Borrar lote</button>
              </div>
            </div>`;
        });

        html += `</div></div>`;
      }
      html += `</div></div>`;
    }
    div.innerHTML = html;
  }

  window.borrarFilaBanco = function (rowId, tema, cantidad) {
    if (!confirm(`¿Borrar las ${cantidad} preguntas de "${tema}"?\n\nEsta acción NO se puede deshacer.`)) return;
    apiPost({ action: 'eliminar_fila_banco', row_id: rowId })
      .then(() => {
        toast(`🗑️ Lote "${tema}" eliminado (${cantidad} preguntas)`, 'success');
        cargarEstadoAlmacen();
      })
      .catch(e => toast('❌ ' + e.message, 'error'));
  };

  // ==========================================
  // TAB 2: ARMADOR
  // ==========================================
  function renderUnidadesDisponibles() {
    const grado = document.getElementById('fPruebaGrado').value;
    const asig = document.getElementById('fPruebaAsig').value;
    const div = document.getElementById('unidadesCheckboxes');
    const filtrado = estadisticasBanco.filter(s => s.grado == grado && s.asignatura == asig);

    if (filtrado.length === 0) {
      div.innerHTML = `<span style="color:#ef4444">No hay preguntas en el Almacén para ${asig} ${grado}°.</span>`;
      document.getElementById('lblTotalPool').textContent = '0';
      return;
    }

    let html = '';
    filtrado.forEach(s => {
      html += `<label style="display:flex; align-items:center; gap:0.5rem; cursor:pointer;">
                 <input type="checkbox" class="chk-unidad" value="${s.unidad}" data-count="${s.total_preguntas}" onchange="window.calcularPool()">
                 ☑️ Unidad ${s.unidad} <span style="opacity:0.6">(${s.total_preguntas} preg disponibles)</span>
               </label>`;
    });
    div.innerHTML = html;
    window.calcularPool();
  }

  window.calcularPool = function () {
    let total = 0;
    document.querySelectorAll('.chk-unidad:checked').forEach(chk => {
      total += parseInt(chk.dataset.count);
    });
    document.getElementById('lblTotalPool').textContent = total;
    let inputCant = document.getElementById('fPruebaCant');
    inputCant.max = total;
    if (parseInt(inputCant.value) > total) inputCant.value = total;
  };

  function activarPrueba() {
    const nombre = document.getElementById('fPruebaNombre').value.trim();
    const grado = document.getElementById('fPruebaGrado').value;
    const asig = document.getElementById('fPruebaAsig').value;
    const cant = parseInt(document.getElementById('fPruebaCant').value) || 15;
    const monedas = parseInt(document.getElementById('fPruebaMonedas').value) || 35;
    const xp = parseInt(document.getElementById('fPruebaXp').value) || 18;

    let unidades = [];
    document.querySelectorAll('.chk-unidad:checked').forEach(chk => unidades.push(parseInt(chk.value)));

    if (!nombre) return toast('Falta el Nombre Visible', 'warning');
    if (unidades.length === 0) return toast('Debes seleccionar al menos 1 Unidad', 'warning');

    var btn = document.getElementById('btnActivarPrueba');
    btn.disabled = true; btn.textContent = 'Procesando...';

    let accionApi = window._editandoPruebaId ? 'editar_prueba_activa' : 'crear_prueba_activa';

    apiPost({
      action: accionApi, id: window._editandoPruebaId,
      nombre, grado: Number(grado), asignatura: asig, unidades,
      preguntas_por_intento: cant, recompensa_monedas: monedas, recompensa_xp: xp
    }).then(() => {
      toast(window._editandoPruebaId ? '✅ Cambios guardados' : '🚀 Evaluación Activada', 'success');
      window._editandoPruebaId = null;
      document.getElementById('fPruebaNombre').value = '';
      btn.textContent = '🚀 ACTIVAR EVALUACIÓN';
      btn.style.background = ''; btn.style.color = ''; btn.style.borderColor = '';
      cargarPruebasActivas();
    }).catch(e => toast('❌ ' + e.message, 'error'))
      .finally(() => { btn.disabled = false; });
  }

  function cargarPruebasActivas() {
    apiPost({ action: 'get_pruebas_activas' }).then(res => {
      window._listaPruebasGlobal = res.pruebas || [];
      const div = document.getElementById('listaPruebasActivas');
      if (!res.pruebas || res.pruebas.length === 0) {
        div.innerHTML = '<span style="color:var(--text-dim)">No hay evaluaciones activas.</span>';
        return;
      }

      let jerarquia = {};
      res.pruebas.forEach(p => {
        let asig = p.asignatura;
        let carpeta = '📂 Unidad ' + p.unidades.join(', ');
        if (!jerarquia[asig]) jerarquia[asig] = {};
        if (!jerarquia[asig][carpeta]) jerarquia[asig][carpeta] = [];
        jerarquia[asig][carpeta].push(p);
      });

      let html = '';
      for (let asig in jerarquia) {
        html += `
          <div style="background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.1); border-radius:8px; margin-bottom:0.5rem;">
            <div onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display === 'none' ? 'block' : 'none'"
                 style="padding:1rem; cursor:pointer; display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.3); border-radius:8px;">
              <strong style="color:var(--text); font-size:1.05rem;">📁 ${asig}</strong>
              <span style="color:var(--text-dim); font-size:0.8rem;">▼ Expandir</span>
            </div>
            <div style="display:none; padding:0.5rem 1rem;">`;

        for (let carpetaUnidad in jerarquia[asig]) {
          html += `<div style="margin-top:0.8rem; margin-bottom:0.3rem;">
                     <strong style="color:var(--primary); font-size:0.9rem;">${carpetaUnidad}</strong>
                   </div>`;

          jerarquia[asig][carpetaUnidad].forEach(p => {
            let opacidad = p.activa ? '1' : '0.5';
            let icon = p.activa ? '📄' : '📝';
            let textoPreguntas = `[${p.preguntas_por_intento} preg.]`;
            let badgeForzada = p.forzada
              ? `<span style="font-size:0.7rem; background:rgba(234,179,8,0.15); color:#eab308; border:1px solid rgba(234,179,8,0.35); border-radius:4px; padding:1px 6px; margin-left:0.4rem; font-weight:700;">⚡ FORZADA</span>`
              : '';
            html += `
              <div style="display:flex; justify-content:space-between; align-items:center; padding:0.6rem 0.8rem; background:rgba(0,0,0,0.2); border-left:3px solid ${p.activa ? (p.forzada ? '#eab308' : '#22c55e') : '#ef4444'}; border-radius:4px; margin-bottom:0.4rem; opacity:${opacidad}; margin-left:1rem; flex-wrap:wrap; gap:0.5rem;">
                <div>
                  <div style="font-weight:700; color:var(--text); font-size:0.85rem;">${icon} ${p.nombre} (Grado ${p.grado}°) - <span style="color:var(--text-dim); font-weight:normal;">${textoPreguntas}</span>${badgeForzada}</div>
                </div>
                <div style="display:flex; gap:0.4rem; flex-wrap:wrap;">
                  <button class="btn-admin btn-sm" onclick="previsualizarPrueba('${p.id}')" style="background:rgba(168,85,247,0.1); color:#a855f7; border:1px solid rgba(168,85,247,0.3);">👁️ Ver</button>
                  <button class="btn-admin btn-sm" onclick="navigator.clipboard.writeText(BASE_URL + '/evaluaciones/preparacion.html?id=${p.id}'); toast('Link copiado', 'success')" style="background:rgba(59,130,246,0.1); color:#60a5fa; border:none;">🔗 Link</button>
                  <button class="btn-admin btn-sm" onclick="abrirEditarPrueba('${p.id}')" style="background:rgba(234,179,8,0.1); color:#eab308; border:none;">⚙️ Editar</button>
                  ${p.forzada
                ? `<button class="btn-admin btn-sm" onclick="toggleForzada('${p.id}', false)" style="background:rgba(234,179,8,0.15); color:#eab308; border:1px solid rgba(234,179,8,0.35);">⚡ Desforzar</button>`
                : `<button class="btn-admin btn-sm" onclick="toggleForzada('${p.id}', true)" style="background:rgba(234,179,8,0.05); color:#a8783a; border:1px solid rgba(234,179,8,0.2);">⚡ Forzar</button>`}
                  ${p.activa
                ? `<button class="btn-admin btn-sm" onclick="togglePrueba('${p.id}', false)" style="background:rgba(239,68,68,0.1); color:#ef4444; border:none;">🔴 Desactivar</button>`
                : `<button class="btn-admin btn-sm" onclick="togglePrueba('${p.id}', true)" style="background:rgba(34,197,94,0.1); color:#22c55e; border:none;">🟢 Activar</button>`}
                  <button class="btn-admin btn-sm" onclick="eliminarPrueba('${p.id}', '${p.nombre.replace(/'/g, "\\'")}')" style="background:rgba(239,68,68,0.1); color:#ef4444; border:1px solid rgba(239,68,68,0.3);">🗑️ Borrar</button>
                </div>
              </div>`;
          });
        }
        html += `</div></div>`;
      }
      div.innerHTML = html;
    }).catch(e => console.error(e));
  }

  window.togglePrueba = function (id, estado) {
    apiPost({ action: 'toggle_prueba', id, estado }).then(() => cargarPruebasActivas());
  };

  window.toggleForzada = function (id, forzada) {
    apiPost({ action: 'toggle_forzada', id, forzada })
      .then(() => {
        toast(forzada ? '⚡ Evaluación marcada como forzada' : '✅ Evaluación desforzada', 'success');
        cargarPruebasActivas();
      })
      .catch(e => toast('❌ ' + e.message, 'error'));
  };

  window.eliminarPrueba = function (id, nombre) {
    if (!confirm(`¿Eliminar la evaluación "${nombre}"?\n\nSe borrará junto a todos sus intentos registrados. Esta acción no se puede deshacer.`)) return;
    apiPost({ action: 'eliminar_prueba_activa', id })
      .then(() => {
        toast(`🗑️ Evaluación "${nombre}" eliminada`, 'success');
        cargarPruebasActivas();
      })
      .catch(e => toast('❌ ' + e.message, 'error'));
  };

  // ==========================================
  // PREVISUALIZACIÓN DE EVALUACIÓN ACTIVA
  // ==========================================
  window.previsualizarPrueba = function (id) {
    const p = window._listaPruebasGlobal.find(x => x.id === id);
    if (!p) return;

    document.getElementById('lblEditorTitulo').innerHTML =
      `👁️ ${p.nombre} — ${p.asignatura} ${p.grado}° (Pool completo)`;
    document.getElementById('modalEditor').style.display = 'flex';
    document.getElementById('listaEditorPreguntas').innerHTML =
      '<div style="text-align:center; color:var(--text-dim);">Cargando preguntas del pool...</div>';

    const promesas = p.unidades.map(u =>
      apiPost({ action: 'get_preguntas_unidad', asignatura: p.asignatura, grado: p.grado, unidad: u })
    );

    Promise.all(promesas).then(resultados => {
      let todasFilas = [];
      resultados.forEach(r => { if (r.filas) todasFilas = todasFilas.concat(r.filas); });

      if (todasFilas.length === 0) {
        document.getElementById('listaEditorPreguntas').innerHTML =
          '<span style="color:var(--text-dim)">No hay preguntas en el banco para esta evaluación.</span>';
        return;
      }

      let totalPregs = 0;
      todasFilas.forEach(f => totalPregs += (f.preguntas || []).length);

      const contenedor = document.getElementById('listaEditorPreguntas');
      contenedor.innerHTML = `
        <div style="background:rgba(99,102,241,0.08); border:1px solid rgba(99,102,241,0.2); border-radius:8px; padding:0.8rem 1rem; margin-bottom:1rem; font-size:0.85rem; color:var(--text-dim);">
          📊 Pool total: <strong style="color:var(--primary)">${totalPregs} preguntas</strong> en ${todasFilas.length} lote(s)
          · El alumno verá <strong style="color:var(--primary)">${p.preguntas_por_intento}</strong> por intento
        </div>`;

      renderizarPreguntasEditor(todasFilas, true);

    }).catch(e => {
      document.getElementById('listaEditorPreguntas').innerHTML =
        `<span style="color:#ef4444">Error: ${e.message}</span>`;
    });
  };

  // ==========================================
  // EDITOR VISUAL DE PREGUNTAS
  // ==========================================
  window.abrirEditor = function (asig, grado, unidad) {
    document.getElementById('lblEditorTitulo').innerHTML = `✏️ ${asig} ${grado}° - Unidad ${unidad}`;
    document.getElementById('modalEditor').style.display = 'flex';
    document.getElementById('listaEditorPreguntas').innerHTML =
      '<div style="text-align:center; color:var(--text-dim);">Cargando...</div>';

    apiPost({ action: 'get_preguntas_unidad', asignatura: asig, grado, unidad })
      .then(res => renderizarPreguntasEditor(res.filas, false))
      .catch(e => {
        document.getElementById('listaEditorPreguntas').innerHTML =
          `<span style="color:#ef4444">Error: ${e.message}</span>`;
      });
  };

  // readOnly=true → solo vista, sin botones editar/borrar (previsualización)
  function renderizarPreguntasEditor(filas, readOnly) {
    const contenedor = document.getElementById('listaEditorPreguntas');
    if (!filas || filas.length === 0) {
      contenedor.innerHTML = '<span style="color:var(--text-dim)">No hay preguntas en esta unidad.</span>';
      return;
    }

    if (!readOnly) contenedor._filas = filas;

    let html = '';
    filas.forEach(fila => {
      const temaLabel = fila.tema ? fila.tema : 'Sin tema';
      html += `<div style="font-size:0.75rem; font-weight:800; color:var(--text-dim); text-transform:uppercase; letter-spacing:0.05em; padding:0.4rem 0; border-top:1px solid rgba(255,255,255,0.05); margin-bottom:0.5rem;">
                 📄 Lote: ${temaLabel} (${(fila.preguntas || []).length} preg)
               </div>`;

      fila.preguntas.forEach((q, index) => {
        const tipoColor = { seleccion_multiple: '#3b82f6', verdadero_falso: '#22c55e', unir_conceptos: '#a855f7' }[q.tipo] || 'var(--primary)';
        const tipoLabel = { seleccion_multiple: '🔵 Múltiple', verdadero_falso: '🟢 V / F', unir_conceptos: '🟣 Unir' }[q.tipo] || q.tipo;

        let preview = '';
        if (q.tipo === 'seleccion_multiple' && q.opciones) {
          preview = q.opciones.map(op => `<span style="background:rgba(255,255,255,0.05); padding:0.2rem 0.5rem; border-radius:4px; font-size:0.75rem; ${op === q.correcta ? 'border:1px solid #22c55e; color:#22c55e;' : 'color:var(--text-dim);'}">${escapeVal(op)}</span>`).join(' ');
        } else if (q.tipo === 'verdadero_falso') {
          preview = `<span style="font-size:0.75rem; color:#22c55e;">✅ ${escapeVal(q.correcta)}</span>`;
        } else if (q.tipo === 'unir_conceptos' && q.pares) {
          preview = q.pares.map(p => `<span style="font-size:0.75rem; color:var(--text-dim);">${escapeVal(p.izq)} ↔ ${escapeVal(p.der)}</span>`).join(' &nbsp;|&nbsp; ');
        }

        const botonesEdicion = readOnly ? '' : `
          <div style="display:flex; justify-content:flex-end; gap:0.5rem; border-top:1px solid rgba(255,255,255,0.05); padding-top:0.8rem;">
            <button onclick="abrirFormEdit('${fila.id}', ${index})" style="background:rgba(234,179,8,0.1); color:#eab308; border:1px solid rgba(234,179,8,0.3); padding:0.4rem 0.8rem; border-radius:4px; cursor:pointer; font-size:0.8rem;">✏️ Editar</button>
            <button onclick="borrarPregunta('${fila.id}', ${index})" style="background:rgba(239,68,68,0.1); color:#ef4444; border:1px solid rgba(239,68,68,0.3); padding:0.4rem 0.8rem; border-radius:4px; cursor:pointer; font-size:0.8rem;">🗑️ Borrar</button>
          </div>`;

        const modoEdicion = readOnly ? '' : `
          <div id="edit-q-${fila.id}-${index}" style="display:none; background:rgba(0,0,0,0.5); border:1px solid var(--primary); border-radius:8px; padding:1.2rem; margin-bottom:1rem;">
            <div style="font-size:0.9rem; font-weight:bold; color:var(--primary); margin-bottom:1rem;">✏️ Editar Pregunta — ID: ${q.id_pregunta}</div>
            <div id="form-q-${fila.id}-${index}">${buildFormularioVisual(q, fila.id, index)}</div>
            <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1rem; border-top:1px solid rgba(255,255,255,0.1); padding-top:1rem;">
              <button onclick="cerrarFormEdit('${fila.id}', ${index})" style="background:transparent; color:var(--text-dim); border:1px solid rgba(255,255,255,0.1); padding:0.4rem 0.8rem; border-radius:4px; cursor:pointer; font-size:0.8rem;">❌ Cancelar</button>
              <button onclick="guardarPreguntaVisual('${fila.id}', ${index})" style="background:rgba(34,197,94,0.1); color:#22c55e; border:1px solid rgba(34,197,94,0.3); padding:0.5rem 1rem; border-radius:4px; cursor:pointer; font-size:0.85rem; font-weight:700;">💾 Guardar Cambios</button>
            </div>
          </div>`;

        html += `
          <div id="view-q-${fila.id}-${index}" style="background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.05); border-radius:8px; padding:1rem; margin-bottom:0.8rem;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem; flex-wrap:wrap; gap:0.4rem;">
              <span style="font-size:0.72rem; font-weight:bold; color:${tipoColor}; background:rgba(255,255,255,0.05); padding:0.2rem 0.6rem; border-radius:20px;">${tipoLabel}</span>
              <span style="font-size:0.68rem; color:var(--text-dim);">ID: ${q.id_pregunta}</span>
            </div>
            <div style="font-size:0.95rem; font-weight:700; color:var(--text); margin-bottom:0.6rem;">${escapeVal(q.pregunta)}</div>
            <div style="display:flex; flex-wrap:wrap; gap:0.4rem; margin-bottom:0.6rem;">${preview}</div>
            ${botonesEdicion}
          </div>
          ${modoEdicion}`;
      });
    });

    if (readOnly) {
      const wrapper = document.createElement('div');
      wrapper.innerHTML = html;
      contenedor.appendChild(wrapper);
    } else {
      contenedor.innerHTML = html;
    }
  }

  window.abrirFormEdit = function (rowId, index) {
    document.getElementById(`view-q-${rowId}-${index}`).style.display = 'none';
    document.getElementById(`edit-q-${rowId}-${index}`).style.display = 'block';
  };

  window.cerrarFormEdit = function (rowId, index) {
    document.getElementById(`edit-q-${rowId}-${index}`).style.display = 'none';
    document.getElementById(`view-q-${rowId}-${index}`).style.display = 'block';
  };

  window.guardarPreguntaVisual = function (rowId, index) {
    const contenedor = document.getElementById('listaEditorPreguntas');
    const filas = contenedor._filas;
    if (!filas) return toast('❌ Error interno: filas no encontradas', 'error');
    const fila = filas.find(f => String(f.id) === String(rowId));
    if (!fila) return toast('❌ No se encontró la fila', 'error');
    const qOriginal = fila.preguntas[index];
    let nuevaPregunta;
    try { nuevaPregunta = extraerPreguntaDesdeFormulario(qOriginal, rowId, index); }
    catch (e) { return toast('❌ Error al leer el formulario: ' + e.message, 'error'); }
    if (!nuevaPregunta.pregunta) return toast('⚠️ El enunciado no puede estar vacío', 'warning');
    apiPost({ action: 'editar_pregunta_banco', row_id: rowId, index, nueva_pregunta: nuevaPregunta })
      .then(() => {
        toast('✅ Pregunta editada correctamente', 'success');
        document.getElementById('modalEditor').style.display = 'none';
        cargarEstadoAlmacen();
      }).catch(e => toast('❌ ' + e.message, 'error'));
  };

  window.borrarPregunta = function (rowId, index) {
    if (!confirm('¿Seguro que quieres borrar esta pregunta? Esta acción no se puede deshacer.')) return;
    apiPost({ action: 'eliminar_pregunta_banco', row_id: rowId, index })
      .then(() => {
        toast('🗑️ Pregunta eliminada', 'success');
        document.getElementById('modalEditor').style.display = 'none';
        cargarEstadoAlmacen();
      }).catch(e => toast('❌ ' + e.message, 'error'));
  };

  // ==========================================
  // FORMULARIO VISUAL DE EDICIÓN
  // ==========================================
  function buildFormularioVisual(q, rowId, index) {
    const labelStyle = 'display:block; font-size:0.75rem; color:var(--text-dim); margin-bottom:0.3rem; font-weight:700; text-transform:uppercase; letter-spacing:0.05em;';
    const inputStyle = 'width:100%; background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.1); border-radius:6px; padding:0.5rem 0.7rem; color:var(--text); font-size:0.85rem; box-sizing:border-box;';
    let camposEspecificos = '';

    if (q.tipo === 'seleccion_multiple') {
      let opcionesHtml = '';
      const opciones = q.opciones || ['', '', '', ''];
      opciones.forEach((op, i) => {
        const esCorrecta = op === q.correcta;
        opcionesHtml += `
          <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.4rem;">
            <input type="radio" name="correcta-${rowId}-${index}" value="${i}" ${esCorrecta ? 'checked' : ''} style="accent-color:#22c55e; cursor:pointer; flex-shrink:0;">
            <input type="text" class="opcion-input" data-opidx="${i}" value="${escapeVal(op)}" placeholder="Opción ${i + 1}" style="${inputStyle} flex:1;">
            <span style="font-size:0.75rem; color:${esCorrecta ? '#22c55e' : 'var(--text-dim)'};">${esCorrecta ? '✅' : '❌'}</span>
          </div>`;
      });
      camposEspecificos = `<div style="margin-top:0.8rem;"><label style="${labelStyle}">Opciones (selecciona el radio ◉ de la correcta)</label><div id="opciones-wrap-${rowId}-${index}">${opcionesHtml}</div></div>`;

    } else if (q.tipo === 'verdadero_falso') {
      const correcta = q.correcta || 'Verdadero';
      camposEspecificos = `
        <div style="margin-top:0.8rem;">
          <label style="${labelStyle}">Respuesta Correcta</label>
          <div style="display:flex; gap:1rem; margin-top:0.3rem;">
            <label style="display:flex; align-items:center; gap:0.4rem; cursor:pointer; color:var(--text);">
              <input type="radio" name="vf-${rowId}-${index}" value="Verdadero" ${correcta === 'Verdadero' ? 'checked' : ''} style="accent-color:#22c55e;"> ✅ Verdadero
            </label>
            <label style="display:flex; align-items:center; gap:0.4rem; cursor:pointer; color:var(--text);">
              <input type="radio" name="vf-${rowId}-${index}" value="Falso" ${correcta === 'Falso' ? 'checked' : ''} style="accent-color:#ef4444;"> ❌ Falso
            </label>
          </div>
        </div>`;

    } else if (q.tipo === 'unir_conceptos') {
      const pares = q.pares || [{ izq: '', der: '' }, { izq: '', der: '' }, { izq: '', der: '' }];
      let paresHtml = '';
      pares.forEach((par, i) => {
        paresHtml += `
          <div style="display:grid; grid-template-columns:1fr auto 1fr; align-items:center; gap:0.5rem; margin-bottom:0.4rem;">
            <input type="text" class="par-izq" data-paridx="${i}" value="${escapeVal(par.izq)}" placeholder="Concepto izquierda" style="${inputStyle}">
            <span style="color:var(--text-dim); font-size:0.85rem;">↔</span>
            <input type="text" class="par-der" data-paridx="${i}" value="${escapeVal(par.der)}" placeholder="Concepto derecha" style="${inputStyle}">
          </div>`;
      });
      camposEspecificos = `<div style="margin-top:0.8rem;"><label style="${labelStyle}">Pares (Izquierda ↔ Derecha)</label><div id="pares-wrap-${rowId}-${index}">${paresHtml}</div></div>`;
    }

    return `
      <div style="font-size:0.7rem; font-weight:bold; color:var(--primary); text-transform:uppercase; letter-spacing:0.05em; margin-bottom:0.8rem;">Tipo: ${q.tipo.replace(/_/g, ' ')} 🔒</div>
      <div style="margin-bottom:0.7rem;"><label style="${labelStyle}">Enunciado</label><textarea id="vf-enunciado-${rowId}-${index}" style="${inputStyle} resize:vertical; min-height:70px;">${escapeVal(q.pregunta)}</textarea></div>
      <div style="margin-bottom:0.7rem;"><label style="${labelStyle}">Imagen URL (Opcional)</label><input type="text" id="vf-imagen-${rowId}-${index}" value="${escapeVal(q.imagen_url || '')}" placeholder="https://... o dejar vacío" style="${inputStyle}"></div>
      ${camposEspecificos}`;
  }

  function escapeVal(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function extraerPreguntaDesdeFormulario(q, rowId, index) {
    const enunciado = document.getElementById(`vf-enunciado-${rowId}-${index}`).value.trim();
    const imagenUrl = document.getElementById(`vf-imagen-${rowId}-${index}`).value.trim() || null;
    let nueva = { id_pregunta: q.id_pregunta, tipo: q.tipo, pregunta: enunciado, imagen_url: imagenUrl };

    if (q.tipo === 'seleccion_multiple') {
      const wrap = document.getElementById(`opciones-wrap-${rowId}-${index}`);
      const opciones = Array.from(wrap.querySelectorAll('.opcion-input')).map(inp => inp.value.trim());
      const radioChecked = wrap.querySelector(`input[name="correcta-${rowId}-${index}"]:checked`);
      const idxCorrecta = radioChecked ? parseInt(radioChecked.value) : 0;
      nueva.opciones = opciones;
      nueva.correcta = opciones[idxCorrecta] || '';
    } else if (q.tipo === 'verdadero_falso') {
      const vfChecked = document.querySelector(`input[name="vf-${rowId}-${index}"]:checked`);
      nueva.opciones = ['Verdadero', 'Falso'];
      nueva.correcta = vfChecked ? vfChecked.value : 'Verdadero';
    } else if (q.tipo === 'unir_conceptos') {
      const wrap = document.getElementById(`pares-wrap-${rowId}-${index}`);
      const izqs = wrap.querySelectorAll('.par-izq');
      const ders = wrap.querySelectorAll('.par-der');
      nueva.pares = Array.from(izqs).map((inp, i) => ({ izq: inp.value.trim(), der: ders[i].value.trim() }));
    }
    return nueva;
  }

  // ==========================================
  // API HELPER
  // ==========================================
  async function apiPost(bodyObj) {
    let token = window.CLERK_TOKEN;
    if (window.Clerk && window.Clerk.session) {
      token = await window.Clerk.session.getToken();
    }
    return fetch(BASE_URL + '/api/admin', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyObj)
    }).then(r => r.json()).then(data => {
      if (data.error) throw new Error(data.mensaje || 'Error del servidor');
      return data;
    });
  }

})(); // fin IIFE

// ==========================================
// HELPERS GLOBALES
// ==========================================
window.abrirEditarPrueba = function (id) {
  const p = window._listaPruebasGlobal.find(x => x.id === id);
  if (!p) return;

  window._editandoPruebaId = p.id;
  document.getElementById('fPruebaNombre').value = p.nombre;
  document.getElementById('fPruebaGrado').value = p.grado;
  document.getElementById('fPruebaAsig').value = p.asignatura;
  document.getElementById('fPruebaCant').value = p.preguntas_por_intento;
  document.getElementById('fPruebaMonedas').value = p.recompensa_monedas;
  document.getElementById('fPruebaXp').value = p.recompensa_xp;

  // Cambiar a la tab del armador PRIMERO para que los checkboxes existan en el DOM
  document.querySelector('.admin-tab[data-tab="armador"]').click();

  // Luego marcar las unidades con delay para que renderUnidadesDisponibles haya corrido
  setTimeout(() => {
    document.querySelectorAll('.chk-unidad').forEach(chk => {
      chk.checked = p.unidades.includes(parseInt(chk.value));
    });
    window.calcularPool && window.calcularPool();
  }, 200);

  const btn = document.getElementById('btnActivarPrueba');
  btn.textContent = '💾 GUARDAR CAMBIOS';
  btn.style.background = 'rgba(234,179,8,0.1)';
  btn.style.color = '#eab308';
  btn.style.borderColor = 'rgba(234,179,8,0.3)';

  window.scrollTo({ top: 0, behavior: 'smooth' });
};
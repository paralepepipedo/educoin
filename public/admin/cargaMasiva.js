// ============================================
// cargaMasiva.js — Lógica de carga masiva de evaluaciones
// Versión: 1.0.0 — 2026-03-12
// Requiere: pdf.js de CDN, admin.js
// ============================================

(function () {
  'use strict';

  // Estado global del modal
  var cargaMasivaState = {
    pasoActual: 1,
    colegio_id: null,
    colegio_nombre: null,
    grado: null,
    evaluacionesDetectadas: [],
    colegios: []
  };

  // Mapeo de asignaturas (normalización)
  var ASIGNATURAS_MAP = {
    'matematica': 'Matematicas',
    'matematicas': 'Matematicas',
    'matemática': 'Matematicas',
    'matemáticas': 'Matematicas',
    'lenguaje': 'Lenguaje',
    'lenguaje y comunicacion': 'Lenguaje',
    'lenguaje y comunicación': 'Lenguaje',
    'historia': 'Historia',
    'historia geografia': 'Historia',
    'historia, geografia': 'Historia',
    'historia, geografía': 'Historia',
    'historia y ciencias sociales': 'Historia',
    'ciencias': 'Ciencias',
    'ciencias naturales': 'Ciencias',
    'ingles': 'Ingles',
    'inglés': 'Ingles',
    'ed fisica': 'Ed. Fisica',
    'ed. fisica': 'Ed. Fisica',
    'educacion fisica': 'Ed. Fisica',
    'educación física': 'Ed. Fisica',
    'educación física y salud': 'Ed. Fisica',
    'musica': 'Musica',
    'música': 'Musica',
    'artes': 'Artes',
    'artes visuales': 'Artes',
    'tecnologia': 'Tecnologia',
    'tecnología': 'Tecnologia'
  };

  // Mapeo de tipos de evaluación
  var TIPO_EVAL_MAP = {
    'proyecto': 'trabajo',
    'trabajo': 'trabajo',
    'tarea': 'tarea',
    'disertacion': 'disertacion',
    'disertación': 'disertacion',
    'laboratorio': 'laboratorio',
    'prueba': 'prueba',
    'evaluacion': 'prueba',
    'evaluación': 'prueba',
    'sumativa': 'prueba',
    'practica': 'prueba',
    'práctica': 'prueba',
    'escrita': 'prueba'
  };

  var MESES = {
    'enero': 1, 'febrero': 2, 'marzo': 3, 'abril': 4,
    'mayo': 5, 'junio': 6, 'julio': 7, 'agosto': 8,
    'septiembre': 9, 'octubre': 10, 'noviembre': 11, 'diciembre': 12
  };

  var DIAS_SEMANA = {
    'lunes': 1, 'martes': 2, 'miercoles': 3, 'miércoles': 3,
    'jueves': 4, 'viernes': 5, 'sabado': 6, 'sábado': 6, 'domingo': 7
  };

  // ------------------------------------------------
  // Funciones públicas (expuestas globalmente)
  // ------------------------------------------------

  window.abrirModalCargaMasiva = function () {
    cargarColegios();
    resetearModal();
    document.getElementById('modalCargaMasiva').style.display = 'flex';
  };

  window.cerrarModalCargaMasiva = function () {
    document.getElementById('modalCargaMasiva').style.display = 'none';
    resetearModal();
  };

  window.irPasoCargaMasiva = function (paso) {
    // Validaciones antes de avanzar
    if (paso === 2 && cargaMasivaState.pasoActual === 1) {
      if (!validarPaso1()) return;
    }

    cargaMasivaState.pasoActual = paso;
    actualizarUI();
  };

  window.seleccionarMetodoEntrada = function (metodo) {
    var opciones = document.querySelectorAll('.metodo-entrada-option');
    opciones.forEach(function (opt) {
      opt.classList.remove('active');
      var color = opt === event.target.closest('.metodo-entrada-option') ? 'white' : 'rgba(255,255,255,.6)';
      opt.querySelector('div:last-child').style.color = color;
    });
    event.target.closest('.metodo-entrada-option').classList.add('active');
  };

  // ================================================
  // Copiar prompt al portapapeles
  // ================================================

  window.copiarPrompt = function () {
    var textarea = document.getElementById('promptExtraer');
    textarea.select();
    textarea.setSelectionRange(0, 99999);

    try {
      document.execCommand('copy');
      toast('✅ Prompt copiado al portapapeles', 'success');
    } catch (err) {
      navigator.clipboard.writeText(textarea.value).then(function () {
        toast('✅ Prompt copiado al portapapeles', 'success');
      }).catch(function () {
        toast('❌ No se pudo copiar. Cópialo manualmente.', 'error');
      });
    }
  };

  // ================================================
  // Procesar JSON de IA externa
  // ================================================

  window.procesarTextoCargaMasiva = function () {
    var texto = document.getElementById('cargaMasivaTexto').value.trim();

    if (!texto) {
      toast('❌ Pega el JSON devuelto por la IA', 'error');
      return;
    }

    try {
      // Limpiar posibles backticks de markdown
      texto = texto.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

      // Parsear JSON
      var evaluaciones = JSON.parse(texto);

      if (!Array.isArray(evaluaciones)) {
        throw new Error('El JSON debe ser un array');
      }

      // Validar y normalizar cada evaluación
      evaluaciones = evaluaciones.map(function (ev, index) {
        if (!ev.fecha || !ev.asignatura) {
          throw new Error('Evaluación ' + (index + 1) + ' incompleta (falta fecha o asignatura)');
        }

        return {
          asignatura: ev.asignatura,
          fecha_evaluacion: ev.fecha,
          tipo_evaluacion: ev.tipo || 'prueba',
          contenidos: ev.contenidos || 'Sin descripción',
          seleccionada: true
        };
      });

      if (!evaluaciones.length) {
        toast('❌ No se encontraron evaluaciones en el JSON', 'error');
        return;
      }

      cargaMasivaState.evaluacionesDetectadas = evaluaciones;
      irPasoCargaMasiva(3);
      renderEvaluacionesDetectadas();
      toast('✅ ' + evaluaciones.length + ' evaluaciones detectadas', 'success');

    } catch (error) {
      console.error('Error parseando JSON:', error);
      toast('❌ Error: ' + error.message, 'error');
    }
  };

  window.guardarEvaluacionesMasivas = function () {
    var seleccionadas = cargaMasivaState.evaluacionesDetectadas.filter(function (evaluacion) {
      return evaluacion.seleccionada;
    });

    if (!seleccionadas.length) {
      toast('Selecciona al menos una evaluación', 'error');
      return;
    }

    var btn = document.getElementById('btnGuardarCargaMasiva');
    btn.disabled = true;
    btn.textContent = '⏳ Guardando...';

    var payload = {
      colegio_id: cargaMasivaState.colegio_id,
      grado: cargaMasivaState.grado,
      created_by_nombre: window._adminNombre || 'Admin',
      evaluaciones: seleccionadas.map(function (evaluacion) {
        return {
          asignatura: evaluacion.asignatura,
          fecha_evaluacion: evaluacion.fecha_evaluacion,
          tipo_evaluacion: evaluacion.tipo_evaluacion,
          contenidos: evaluacion.contenidos,
          origen: 'admin'
        };
      })
    };

    fetch(BASE_URL + '/api/evaluaciones?action=batch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + window.CLERK_TOKEN
      },
      credentials: 'include',
      body: JSON.stringify(payload)
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.success) {
          toast('✅ ' + data.insertadas + ' evaluaciones creadas exitosamente', 'success');
          cerrarModalCargaMasiva();
          // Recargar lista de evaluaciones en el tab principal
          if (typeof cargarEvalsAdmin === 'function') {
            cargarEvalsAdmin();
          }
        } else {
          throw new Error(data.error || 'Error al guardar');
        }
      })
      .catch(function (error) {
        console.error('Error guardando evaluaciones:', error);
        toast('Error al guardar las evaluaciones', 'error');
        btn.disabled = false;
        btn.textContent = '💾 Guardar seleccionadas';
      });
  };

  window.toggleEvalDetectada = function (index) {
    cargaMasivaState.evaluacionesDetectadas[index].seleccionada =
      !cargaMasivaState.evaluacionesDetectadas[index].seleccionada;
    actualizarContadores();
  };

  window.eliminarEvalDetectada = function (index) {
    cargaMasivaState.evaluacionesDetectadas.splice(index, 1);
    renderEvaluacionesDetectadas();
  };

  // ------------------------------------------------
  // Funciones privadas
  // ------------------------------------------------

  function resetearModal() {
    cargaMasivaState.pasoActual = 1;
    cargaMasivaState.colegio_id = null;
    cargaMasivaState.colegio_nombre = null;
    cargaMasivaState.grado = null;
    cargaMasivaState.evaluacionesDetectadas = [];

    document.getElementById('cargaMasivaColegio').value = '';
    document.getElementById('cargaMasivaGrado').value = '';
    document.getElementById('cargaMasivaTexto').value = '';

    actualizarUI();
  }

  function validarPaso1() {
    var colegioSel = document.getElementById('cargaMasivaColegio');
    var gradoSel = document.getElementById('cargaMasivaGrado');

    if (!colegioSel.value) {
      toast('Selecciona un colegio', 'error');
      return false;
    }

    if (!gradoSel.value) {
      toast('Selecciona un grado', 'error');
      return false;
    }

    cargaMasivaState.colegio_id = colegioSel.value;
    cargaMasivaState.colegio_nombre = colegioSel.options[colegioSel.selectedIndex].text;
    cargaMasivaState.grado = parseInt(gradoSel.value);

    return true;
  }

  function actualizarUI() {
    // Mostrar/ocultar pasos
    for (var i = 1; i <= 3; i++) {
      var paso = document.getElementById('cargaMasivaPaso' + i);
      paso.style.display = i === cargaMasivaState.pasoActual ? 'block' : 'none';
    }

    // Actualizar indicador de pasos
    document.querySelectorAll('.step-indicator-item').forEach(function (item) {
      var step = parseInt(item.dataset.step);
      item.classList.remove('active', 'completed');

      if (step < cargaMasivaState.pasoActual) {
        item.classList.add('completed');
        item.querySelector('.step-indicator-number').style.background = '#48bb78';
        item.querySelector('.step-indicator-number').style.color = 'white';
      } else if (step === cargaMasivaState.pasoActual) {
        item.classList.add('active');
        item.querySelector('.step-indicator-number').style.background = '#667eea';
        item.querySelector('.step-indicator-number').style.color = 'white';
      } else {
        item.querySelector('.step-indicator-number').style.background = 'rgba(255,255,255,.15)';
        item.querySelector('.step-indicator-number').style.color = 'rgba(255,255,255,.4)';
      }
    });

    // Actualizar confirmación en paso 3
    if (cargaMasivaState.pasoActual === 3) {
      document.getElementById('confirmColegio').textContent = cargaMasivaState.colegio_nombre || '';
      document.getElementById('confirmGrado').textContent = cargaMasivaState.grado + '° Básico';
    }
  }

  function cargarColegios() {
    if (!window.CLERK_TOKEN) return;

    fetch(BASE_URL + '/api/admin?action=colegios', {
      headers: { 'Authorization': 'Bearer ' + window.CLERK_TOKEN },
      credentials: 'include'
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        cargaMasivaState.colegios = data.colegios || [];
        var select = document.getElementById('cargaMasivaColegio');

        select.innerHTML = '<option value="">Seleccionar colegio...</option>' +
          cargaMasivaState.colegios.map(function (c) {
            return '<option value="' + c.id + '">' + esc(c.nombre) + '</option>';
          }).join('');
      })
      .catch(function (err) {
        console.error('Error cargando colegios:', err);
      });
  }

  // ------------------------------------------------
  // Parsing de texto
  // ------------------------------------------------

  function parsearTextoEvaluaciones(texto) {
    var evaluaciones = [];

    // NORMALIZACIÓN AGRESIVA DEL TEXTO PDF
    // 1. Quitar espacios extras entre dígitos: "0 2" → "02"
    texto = texto.replace(/(\d)\s+(\d)/g, '$1$2');

    // 2. Separar días de semana que están juntos: "Lunes 02 Martes 03" → "Lunes 02\nMartes 03"
    texto = texto.replace(/(Lunes|Martes|Miércoles|Miercoles|Jueves|Viernes|Sábado|Sabado|Domingo)\s+(\d{1,2})\s+(?=(Lunes|Martes|Miércoles|Miercoles|Jueves|Viernes|Sábado|Sabado|Domingo))/gi, '$1 $2\n');

    // 3. Agregar saltos de línea después de ciertos patrones
    texto = texto.replace(/\.\s+(?=[A-ZÁÉÍÓÚ])/g, '.\n'); // Después de puntos seguidos de mayúscula
    texto = texto.replace(/([a-z])\s{2,}([A-ZÁÉÍÓÚ])/g, '$1\n$2'); // Dos espacios seguidos de mayúscula

    // Extraer mes y año
    var mesAnioMatch = texto.match(/([A-ZÁÉÍÓÚ]+)\s+(\d{4})/i);
    var mes = 3, anio = new Date().getFullYear();

    if (mesAnioMatch) {
      var mesNombre = mesAnioMatch[1].toLowerCase();
      mes = MESES[mesNombre] || mes;
      anio = parseInt(mesAnioMatch[2]);
    }

    // Estrategia: Buscar patrones "DíaSemana Número" seguidos de contenido hasta el siguiente "DíaSemana Número"
    var bloques = [];
    var patronDia = /(Lunes|Martes|Miércoles|Miercoles|Jueves|Viernes|Sábado|Sabado|Domingo)\s+(\d{1,2})/gi;
    var match;
    var posiciones = [];

    // Encontrar todas las posiciones de días
    while ((match = patronDia.exec(texto)) !== null) {
      posiciones.push({
        index: match.index,
        dia: parseInt(match[2]),
        diaSemana: match[1],
        match: match[0]
      });
    }

    // Para cada bloque de 5 días consecutivos (una fila de la tabla)
    for (var i = 0; i < posiciones.length; i += 5) {
      var fila = posiciones.slice(i, i + 5);

      if (fila.length === 0) continue;

      // Extraer el texto entre esta fila y la siguiente fila de días
      var inicioFila = fila[0].index;
      var finFila = (i + 5 < posiciones.length) ? posiciones[i + 5].index : texto.length;
      var textoFila = texto.substring(inicioFila, finFila);

      // Dividir en líneas
      var lineas = textoFila.split('\n').map(function (l) { return l.trim(); }).filter(function (l) { return l.length > 0; });

      // Primera línea tiene los 5 días, saltarla
      lineas.shift();

      // Buscar asignaturas en las líneas restantes
      var asignaturasPorColumna = [[], [], [], [], []]; // 5 columnas
      var asigActual = null;
      var colActual = -1;

      for (var j = 0; j < lineas.length; j++) {
        var linea = lineas[j];

        // Detectar asignatura
        var asigDetectada = detectarAsignatura(linea);

        if (asigDetectada) {
          // Nueva asignatura encontrada
          asigActual = {
            asignatura: asigDetectada,
            tipo: '',
            contenidos: []
          };

          // Determinar columna (heurística: las evaluaciones van de izq a derecha)
          colActual++;
          if (colActual >= 5) colActual = 4; // No pasar de la última columna

          asignaturasPorColumna[colActual].push(asigActual);
        } else if (asigActual) {
          // Acumular contenido
          if (!asigActual.tipo && esPosibleTipo(linea)) {
            asigActual.tipo = linea;
          } else {
            asigActual.contenidos.push(linea);
          }
        }
      }

      // Convertir a evaluaciones con fechas
      for (var col = 0; col < 5; col++) {
        if (col >= fila.length) break;

        var fecha = construirFecha(anio, mes, fila[col].dia);
        var asigsDia = asignaturasPorColumna[col];

        asigsDia.forEach(function (asig) {
          evaluaciones.push({
            asignatura: asig.asignatura,
            fecha_evaluacion: fecha,
            tipo_evaluacion: detectarTipoEvaluacion(asig.tipo),
            contenidos: asig.contenidos.join(' ').trim(),
            seleccionada: true
          });
        });
      }
    }

    return evaluaciones;
  }

  function detectarAsignatura(texto) {
    var textoLimpio = texto.toLowerCase()
      .replace(/[áàä]/g, 'a')
      .replace(/[éèë]/g, 'e')
      .replace(/[íìï]/g, 'i')
      .replace(/[óòö]/g, 'o')
      .replace(/[úùü]/g, 'u');

    for (var key in ASIGNATURAS_MAP) {
      if (textoLimpio.includes(key)) {
        return ASIGNATURAS_MAP[key];
      }
    }

    return null;
  }

  function esPosibleTipo(texto) {
    var textoLower = texto.toLowerCase();
    return textoLower.includes('evaluacion') ||
      textoLower.includes('evaluación') ||
      textoLower.includes('sumativa') ||
      textoLower.includes('proyecto') ||
      textoLower.includes('prueba') ||
      textoLower.includes('práctica') ||
      textoLower.includes('practica') ||
      /^\d+[°ª]\s*(evaluaci|ev\.|prueba|trabajo)/i.test(texto);
  }

  function detectarTipoEvaluacion(textoTipo) {
    if (!textoTipo) return 'prueba';

    var textoLower = textoTipo.toLowerCase();

    for (var key in TIPO_EVAL_MAP) {
      if (textoLower.includes(key)) {
        return TIPO_EVAL_MAP[key];
      }
    }

    return 'prueba';
  }

  function construirFecha(anio, mes, dia) {
    // Formato YYYY-MM-DD
    var mesStr = mes < 10 ? '0' + mes : '' + mes;
    var diaStr = dia < 10 ? '0' + dia : '' + dia;
    return anio + '-' + mesStr + '-' + diaStr;
  }

  function renderEvaluacionesDetectadas() {
    var container = document.getElementById('listaEvalsDetectadas');

    if (!cargaMasivaState.evaluacionesDetectadas.length) {
      container.innerHTML = '<p style="text-align:center; padding:2rem; color:rgba(255,255,255,.4)">No se detectaron evaluaciones</p>';
      return;
    }

    var ASIG_CONFIG = {
      'Matematicas': { emoji: '🔢', color: '#3b82f6' },
      'Lenguaje': { emoji: '📚', color: '#8b5cf6' },
      'Historia': { emoji: '🌎', color: '#f59e0b' },
      'Ciencias': { emoji: '🔬', color: '#10b981' },
      'Ingles': { emoji: '🇬🇧', color: '#ec4899' },
      'Ed. Fisica': { emoji: '⚽', color: '#ef4444' },
      'Musica': { emoji: '🎵', color: '#06b6d4' },
      'Artes': { emoji: '🎨', color: '#f97316' },
      'Tecnologia': { emoji: '💻', color: '#6366f1' }
    };

    var TIPO_LABELS = {
      'prueba': '📝 Prueba',
      'trabajo': '📄 Trabajo',
      'tarea': '✍️ Tarea',
      'disertacion': '🎤 Disertación',
      'laboratorio': '🔬 Laboratorio'
    };

    container.innerHTML = cargaMasivaState.evaluacionesDetectadas.map(function (evaluacion, index) {
      var cfg = ASIG_CONFIG[evaluacion.asignatura] || { emoji: '📋', color: '#64748b' };
      var fecha = new Date(evaluacion.fecha_evaluacion + 'T12:00:00');
      var fechaStr = fecha.toLocaleDateString('es-CL', {
        weekday: 'short',
        day: 'numeric',
        month: 'short'
      });

      return '<div class="eval-detectada-card ' + (evaluacion.seleccionada ? 'selected' : '') + '">' +
        '<div style="display:flex; align-items:center; gap:12px; margin-bottom:10px">' +
        '<input type="checkbox" ' + (evaluacion.seleccionada ? 'checked' : '') + ' ' +
        'onchange="toggleEvalDetectada(' + index + ')" ' +
        'style="width:18px; height:18px; cursor:pointer">' +
        '<div style="flex:1">' +
        '<div style="font-weight:600; color:#667eea; font-size:13px; font-family:\'Nunito\',sans-serif">📅 ' + fechaStr + '</div>' +
        '<div style="font-weight:700; color:white; font-size:15px; margin-top:2px; font-family:\'Nunito\',sans-serif">' +
        cfg.emoji + ' ' + esc(evaluacion.asignatura) +
        '</div>' +
        '</div>' +
        '<span style="background:rgba(59,130,246,.15); color:#60a5fa; padding:4px 10px; border-radius:12px; font-size:11px; font-weight:700; font-family:\'Nunito\',sans-serif">' +
        (TIPO_LABELS[evaluacion.tipo_evaluacion] || evaluacion.tipo_evaluacion) +
        '</span>' +
        '</div>' +
        '<div style="color:rgba(255,255,255,.5); font-size:12px; line-height:1.5; margin-bottom:10px; font-family:\'Nunito\',sans-serif">' +
        esc(evaluacion.contenidos || 'Sin descripción') +
        '</div>' +
        '<div style="display:flex; gap:8px">' +
        '<button onclick="eliminarEvalDetectada(' + index + ')" ' +
        'style="background:rgba(239,68,68,.12); border:1px solid rgba(239,68,68,.3); color:#ef4444; border-radius:6px; padding:6px 12px; font-size:11px; cursor:pointer; font-family:\'Nunito\',sans-serif; font-weight:600">' +
        '🗑️ Eliminar' +
        '</button>' +
        '</div>' +
        '</div>';
    }).join('');

    actualizarContadores();
    configurarSelectAll();
  }

  function actualizarContadores() {
    var total = cargaMasivaState.evaluacionesDetectadas.length;
    var seleccionadas = cargaMasivaState.evaluacionesDetectadas.filter(function (evaluacion) {
      return evaluacion.seleccionada;
    }).length;

    document.getElementById('totalEvals').textContent = total;
    document.getElementById('contadorEvals').textContent = total + (total === 1 ? ' evaluación' : ' evaluaciones');
    document.getElementById('btnGuardarCargaMasiva').textContent =
      '💾 Guardar seleccionadas (' + seleccionadas + ' de ' + total + ')';

    // Actualizar checkbox "seleccionar todas"
    var selectAll = document.getElementById('selectAllEvals');
    if (selectAll) {
      selectAll.checked = seleccionadas === total && total > 0;
      selectAll.indeterminate = seleccionadas > 0 && seleccionadas < total;
    }
  }

  function configurarSelectAll() {
    var checkbox = document.getElementById('selectAllEvals');
    if (!checkbox._bound) {
      checkbox._bound = true;
      checkbox.addEventListener('change', function () {
        var seleccionar = this.checked;
        cargaMasivaState.evaluacionesDetectadas.forEach(function (evaluacion) {
          evaluacion.seleccionada = seleccionar;
        });
        renderEvaluacionesDetectadas();
      });
    }
  }

  // ------------------------------------------------
  // Inicialización cuando se carga el DOM
  // ------------------------------------------------

  // No hay inicialización necesaria por ahora

  // Función helper para escapar HTML
  function esc(str) {
    if (!str) return '';
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

})();
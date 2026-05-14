/* admin-drag-drop.js — drag & drop voor secties en vragen op de
 * /admin/surveys/:id/edit pagina. Vereist SortableJS (geladen via CDN
 * vóór dit script). Veilig om elders te laden — alle init's guard'en
 * op het bestaan van hun container.
 *
 * Werking:
 *   1. Secties: sleep een hele sectie omhoog/omlaag in #surveySectionList.
 *      Bij drop -> POST JSON {ids:[...]} naar de reorder-URL op de
 *      container. Server herrangschikt display_order.
 *   2. Vragen: ELKE .sq-group-list is een eigen Sortable, maar ze delen
 *      group 'sq-questions' -> dus je kan slepen binnen èn tussen secties.
 *      Bij drop (in eender welke groep) -> verzamel ALLE vragen in DOM-
 *      volgorde over alle groepen heen, leg de section_id vast uit de
 *      groep waar elke vraag in zit, POST JSON {items:[{code,section}]}.
 *
 * Optimistic UI: we updaten de UI direct (door SortableJS zelf), dan
 * pas de server. Faalt de server -> flash error + reload zodat de
 * weergave terug matcht.
 */
(function () {
  'use strict'

  // ── 0. Wacht tot SortableJS geladen is. Het CDN-script heeft defer,
  //    en dit script ook -> beide draaien na DOMContentLoaded, maar de
  //    laadvolgorde is niet 100% gegarandeerd op alle browsers.
  function whenReady(cb) {
    if (typeof window.Sortable !== 'undefined') return cb()
    // Poll kort; geef op na 3s.
    var tries = 0
    var t = setInterval(function () {
      tries++
      if (typeof window.Sortable !== 'undefined') {
        clearInterval(t)
        cb()
      } else if (tries > 30) {
        clearInterval(t)
        console.warn('SortableJS niet geladen — drag-and-drop uit.')
      }
    }, 100)
  }

  // ── helper: tijdelijke toast (1.8s) bovenin
  function toast(msg, isError) {
    var t = document.createElement('div')
    t.textContent = msg
    t.style.cssText = [
      'position:fixed', 'top:20px', 'left:50%',
      'transform:translateX(-50%)',
      'background:' + (isError ? '#b03030' : '#2d8a8a'),
      'color:#fff', 'padding:10px 18px', 'border-radius:6px',
      'font-size:13.5px', 'font-weight:500',
      'box-shadow:0 4px 16px rgba(0,0,0,0.2)',
      'z-index:9999', 'opacity:0',
      'transition:opacity 0.25s ease',
    ].join(';')
    document.body.appendChild(t)
    requestAnimationFrame(function () { t.style.opacity = '1' })
    setTimeout(function () {
      t.style.opacity = '0'
      setTimeout(function () { t.remove() }, 300)
    }, 1800)
  }

  whenReady(function () {

    // ─────────── 1. Secties herordenen ───────────
    var sectionList = document.getElementById('surveySectionList')
    if (sectionList) {
      var sectionReorderUrl = sectionList.getAttribute('data-reorder-url') || ''
      window.Sortable.create(sectionList, {
        handle: '.ss-drag',
        animation: 150,
        ghostClass: 'sortable-ghost',
        chosenClass: 'sortable-chosen',
        dragClass: 'sortable-drag',
        onEnd: function () {
          var rows = sectionList.querySelectorAll('.survey-section-row')
          var ids = Array.prototype.map.call(rows, function (r) {
            return r.getAttribute('data-section-id')
          }).filter(Boolean)
          if (ids.length === 0 || !sectionReorderUrl) return
          fetch(sectionReorderUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: ids }),
            credentials: 'same-origin',
          })
            .then(function (r) {
              if (!r.ok) throw new Error('HTTP ' + r.status)
              return r.json()
            })
            .then(function (data) {
              if (!data || !data.ok) throw new Error((data && data.error) || 'fout')
              // Update the visible "1.", "2." order numbers
              renumberSections()
              toast('Hoofdstuk-volgorde opgeslagen')
            })
            .catch(function (err) {
              console.error('section reorder failed', err)
              toast('Opslaan mislukt — pagina wordt herladen', true)
              setTimeout(function () { location.reload() }, 1200)
            })
        },
      })

      // Click op de drag-handle moet niet de <details> openen
      sectionList.querySelectorAll('.ss-drag').forEach(function (h) {
        h.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation() })
      })
    }

    function renumberSections() {
      var rows = document.querySelectorAll('#surveySectionList .survey-section-row')
      Array.prototype.forEach.call(rows, function (r, i) {
        var o = r.querySelector('.ss-order')
        if (o) o.textContent = (i + 1) + '.'
      })
    }

    // ─────────── 2. Vragen herordenen — binnen en tussen secties ───────────
    var questionGroups = document.getElementById('surveyQuestionGroups')
    if (questionGroups) {
      var questionReorderUrl = questionGroups.getAttribute('data-reorder-url') || ''
      var lists = questionGroups.querySelectorAll('.sq-group-list')

      Array.prototype.forEach.call(lists, function (listEl) {
        window.Sortable.create(listEl, {
          group: 'sq-questions', // shared group → cross-section drops enabled
          handle: '.sq-drag',
          animation: 150,
          ghostClass: 'sortable-ghost',
          chosenClass: 'sortable-chosen',
          dragClass: 'sortable-drag',
          onAdd: function (evt) {
            // Visual feedback while a row is hovering over an empty/other list
            evt.to.classList.remove('drag-over')
          },
          onEnd: function () {
            syncAllQuestions()
          },
        })
      })

      // Toggle .drag-over on lists while dragging (for visual feedback on empty lists)
      Array.prototype.forEach.call(lists, function (listEl) {
        listEl.addEventListener('dragenter', function () {
          // not used by SortableJS (uses pointer events), but keep for native fallback
        })
      })

      // Click op vraag-drag-handle mag geen ander event triggeren
      questionGroups.querySelectorAll('.sq-drag').forEach(function (h) {
        h.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation() })
      })

      function syncAllQuestions() {
        // Walk over EVERY group, in DOM order. For each question row,
        // capture the section_id of the group it's currently sitting in.
        var items = []
        var groups = questionGroups.querySelectorAll('.sq-group')
        Array.prototype.forEach.call(groups, function (g) {
          var sid = g.getAttribute('data-section-id') || 'algemeen'
          var rows = g.querySelectorAll('.survey-question-row')
          Array.prototype.forEach.call(rows, function (r) {
            var code = r.getAttribute('data-code')
            if (code) items.push({ code: code, section: sid })
          })
        })
        if (items.length === 0 || !questionReorderUrl) return
        fetch(questionReorderUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: items }),
          credentials: 'same-origin',
        })
          .then(function (r) {
            if (!r.ok) throw new Error('HTTP ' + r.status)
            return r.json()
          })
          .then(function (data) {
            if (!data || !data.ok) throw new Error((data && data.error) || 'fout')
            renumberQuestions()
            toast('Vragen-volgorde opgeslagen')
          })
          .catch(function (err) {
            console.error('question reorder failed', err)
            toast('Opslaan mislukt — pagina wordt herladen', true)
            setTimeout(function () { location.reload() }, 1200)
          })
      }

      function renumberQuestions() {
        var rows = questionGroups.querySelectorAll('.survey-question-row')
        Array.prototype.forEach.call(rows, function (r, i) {
          var o = r.querySelector('.sq-order')
          if (o) o.textContent = (i + 1) + '.'
        })
      }
    }
  })
})()

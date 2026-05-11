/* admin-survey-edit.js — runs on /admin/surveys/:id/edit and on /admin (the
 * overview cards). Handles:
 *   1. Live character-count for intro_nl/en + thanks_nl/en textareas.
 *   2. Confirmation dialog before duplicating / deleting a survey.
 *   3. Auto-fade the flash banner after 4.5s.
 *
 * Safe to load on pages that don't have these elements — every block guards
 * for null. IIFE so we don't pollute the global scope.
 */
(function () {
  'use strict'

  // ─── 1. Character counters ────────────────────────────────────────────────
  document.querySelectorAll('.char-count[data-target]').forEach(function (el) {
    var targetId = el.getAttribute('data-target')
    var ta = document.getElementById(targetId)
    if (!ta) return
    var max = parseInt(ta.getAttribute('maxLength') || ta.getAttribute('maxlength') || '1000', 10)
    function update() {
      var n = ta.value.length
      el.textContent = n + ' / ' + max
      el.classList.toggle('char-count-warn', n > max * 0.9)
    }
    ta.addEventListener('input', update)
    update()
  })

  // ─── 2. Duplicate confirmation ───────────────────────────────────────────
  document.querySelectorAll('form[action$="/duplicate"]').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      if (!window.confirm(
        'Een kopie aanmaken van deze enquête?\n\n' +
        'De kopie krijgt status "closed" en alle vragen / teksten worden meegenomen.\n' +
        'Responses worden NIET gekopieerd.',
      )) {
        e.preventDefault()
      }
    })
  })

  // ─── 3. Delete confirmation ──────────────────────────────────────────────
  // Edit page: single delete form with id="deleteSurveyForm"
  var editDeleteForm = document.getElementById('deleteSurveyForm')
  if (editDeleteForm) {
    editDeleteForm.addEventListener('submit', function (e) {
      if (!window.confirm(
        'Deze enquête definitief verwijderen?\n\n' +
        'Dit kan NIET ongedaan gemaakt worden.\n' +
        'Tip: als er nog responses zijn, zet de status op "archived" in plaats van te verwijderen.',
      )) {
        e.preventDefault()
      }
    })
  }

  // Overview: many delete forms on the cards
  document.querySelectorAll('form.survey-delete-form').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      var title = form.getAttribute('data-title') || 'deze enquête'
      var responses = parseInt(form.getAttribute('data-responses') || '0', 10)
      if (responses > 0) {
        e.preventDefault()
        window.alert(
          'Deze enquête heeft nog ' + responses + ' actieve reactie(s).\n' +
          'Verwijderen is niet mogelijk — zet hem op "archived" als je hem wilt verbergen.',
        )
        return
      }
      if (!window.confirm('Enquête "' + title + '" definitief verwijderen?')) {
        e.preventDefault()
      }
    })
  })

  // ─── 4. Flash banner auto-fade ───────────────────────────────────────────
  var flash = document.getElementById('flashBanner')
  if (flash) {
    setTimeout(function () {
      flash.style.transition = 'opacity 0.6s ease'
      flash.style.opacity = '0'
      setTimeout(function () { flash.style.display = 'none' }, 700)
    }, 4500)
  }
})()

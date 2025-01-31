/*
 * Copyright (c) 2016-2021 Martin Donath <martin.donath@squidfunk.com>
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to
 * deal in the Software without restriction, including without limitation the
 * rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
 * sell copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NON-INFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
 * IN THE SOFTWARE.
 */

import {
  EMPTY,
  Observable,
  Subject,
  combineLatest,
  defer,
  finalize,
  fromEvent,
  map,
  switchMap,
  take,
  tap
} from "rxjs"

import {
  ElementOffset,
  getElement,
  watchElementContentOffset,
  watchElementFocus,
  watchElementOffset
} from "~/browser"

import { Component } from "../../../../_"

/* ----------------------------------------------------------------------------
 * Types
 * ------------------------------------------------------------------------- */

/**
 * Code annotation
 */
export interface Annotation {
  active: boolean                      /* Code annotation is visible */
  offset: ElementOffset                /* Code annotation offset */
}

/* ----------------------------------------------------------------------------
 * Functions
 * ------------------------------------------------------------------------- */

/**
 * Watch code annotation
 *
 * @param el - Code annotation element
 * @param container - Containing code block element
 *
 * @returns Code annotation observable
 */
export function watchAnnotation(
  el: HTMLElement, container: HTMLElement
): Observable<Annotation> {
  const offset$ = defer(() => combineLatest([
    watchElementOffset(el),
    watchElementContentOffset(container)
  ]))
    .pipe(
      map(([{ x, y }, scroll]) => ({
        x: x - scroll.x,
        y: y - scroll.y
      }))
    )

  /* Actively watch code annotation on focus */
  return watchElementFocus(el)
    .pipe(
      switchMap(active => offset$
        .pipe(
          map(offset => ({ active, offset })),
          take(+!active || Infinity)
        )
      )
    )
}

/**
 * Mount code annotation
 *
 * @param el - Code annotation element
 * @param container - Containing code block element
 *
 * @returns Code annotation component observable
 */
export function mountAnnotation(
  el: HTMLElement, container: HTMLElement
): Observable<Component<Annotation>> {
  return defer(() => {
    const push$ = new Subject<Annotation>()
    push$.subscribe({

      /* Handle emission */
      next({ offset }) {
        el.style.setProperty("--md-tooltip-x", `${offset.x}px`)
        el.style.setProperty("--md-tooltip-y", `${offset.y}px`)
      },

      /* Handle complete */
      complete() {
        el.style.removeProperty("--md-tooltip-x")
        el.style.removeProperty("--md-tooltip-y")
      }
    })

    /* Blur open annotation on click (= close) */
    const index = getElement(":scope > :last-child")
    const blur$ = fromEvent(index, "mousedown", { once: true })
    push$
      .pipe(
        switchMap(({ active }) => active ? blur$ : EMPTY),
        tap(ev => ev.preventDefault())
      )
        .subscribe(() => el.blur())

    /* Create and return component */
    return watchAnnotation(el, container)
      .pipe(
        tap(state => push$.next(state)),
        finalize(() => push$.complete()),
        map(state => ({ ref: el, ...state }))
      )
  })
}

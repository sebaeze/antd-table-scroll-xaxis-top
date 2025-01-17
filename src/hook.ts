import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import type { UIEventHandler } from 'react'

import { Props } from './type'
import { syncScrollLeft, getUniqId } from './helper'
import { lock } from './lock'

/** capsule all scroll logic in a hook */
export const useTableTopScroll = ({ debugName }: Props) => {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const scrollBarRef = useRef<HTMLDivElement>(null)
  const scrollBarWrapperRef = useRef<HTMLDivElement>(null)

  const tableAriaId = useMemo(getUniqId, [])

  const log = useCallback(
    (str: string) => console.info(`${debugName} :: AntdTableScrollXaxisTop occurs error: ${str}`),
    [debugName],
  )

  /** use state to store querySelector results */
  const [innerTableWrapper, setInnerTableWrapper] = useState<HTMLDivElement | null>(null)
  const [innerTable, setInnerTable] = useState<HTMLTableElement | null>(null)

  /** listen bottom scroll event，sync top scroll bar left position */
  const bottomScrollListener = useCallback(() => {
    if (lock.isScrollingTop) {
      return
    }
    const topScrollBarWrapper = scrollBarWrapperRef.current
    if (topScrollBarWrapper && innerTableWrapper) {
      lock.isScrollingBottom = true
      syncScrollLeft(topScrollBarWrapper, innerTableWrapper.scrollLeft)
      lock.releaseIsScrollingBottom()
    }
  }, [innerTableWrapper])

  /** listen top scroll bar event，sync bottom scroll bar left position */
  const topScrollListener: UIEventHandler<HTMLDivElement> = useCallback(
    e => {
      if (lock.isScrollingBottom) {
        return
      }
      if (innerTableWrapper) {
        lock.isScrollingTop = true
        syncScrollLeft(innerTableWrapper, e.currentTarget.scrollLeft)
        lock.releaseIsScrollingTop()
      }
    },
    [innerTableWrapper],
  )

  /** create ResizeObserver to observe table size when data fullfilled */
  const observer = useMemo(
    () =>
      new ResizeObserver(mutationList => {
        mutationList.forEach(mutation => {
          const topScrollBar = scrollBarRef.current
          const wrapper = wrapperRef.current
          if (topScrollBar && wrapper) {
            if (wrapper.clientWidth < mutation.contentRect.width) {
              const topScrollBarWrapper = scrollBarWrapperRef.current
              // computed scrollbar width
              // https://stackoverflow.com/questions/13382516/getting-scroll-bar-width-using-javascript
              if (topScrollBarWrapper) {
                if (mutation.target?.parentElement?.parentElement) {
                  const barWidth =
                    mutation.target.parentElement.parentElement.clientWidth - mutation.target.parentElement.clientWidth
                  if (barWidth > 0) {
                    topScrollBarWrapper.style.width = `calc(100% - ${barWidth}px)`
                  }
                }
              }
              topScrollBar.style.width = `${mutation.contentRect.width}px`
              topScrollBar.style.display = 'inherit'
            } else {
              topScrollBar.style.display = 'none'
            }
          }
        })
      }),
    [],
  )

  /**
   * destroy ResizeObserver when unmount
   * observer will be updated，so do not return `observer.disconnect` directly
   * */
  useEffect(
    () => () => {
      observer.disconnect()
    },
    [observer],
  )

  /** reobserve when table updated */
  useEffect(() => {
    const wrapper = wrapperRef.current
    if (wrapper) {
      const innerTableDoms = wrapper.querySelectorAll(`table`)
      // Search for proper Table element in case of using fixed columns in Antd Table
      const innerTableDom = (innerTableDoms.length>1 && innerTableDoms[1].parentElement!=undefined &&innerTableDoms[1].parentElement.className.indexOf("ant-table-body-inner")==-1 ) 
                            ? innerTableDoms[1]
                            : innerTableDoms[0] ;
      //
      if (!innerTableDom) {
        if (debugName) {
          log(`"table" not found, make sure has antd Table component as children`)
        }
      } else {
        const innerTableWrapperDom = innerTableDom.parentElement as HTMLDivElement
        if (innerTableWrapperDom) {
          setInnerTableWrapper(innerTableWrapperDom)
        }
        if (innerTableDom !== innerTable) {
          setInnerTable(innerTableDom)
        }

        if (innerTableWrapper && innerTable) {
          observer.observe(innerTable, {
            box: 'border-box',
          })
          innerTableWrapper.addEventListener('scroll', bottomScrollListener)
        }
      }
    }
    return () => {
      if (innerTable) {
        observer.unobserve(innerTable)
      }
      if (innerTableWrapper) {
        innerTableWrapper.removeEventListener('scroll', bottomScrollListener)
      }
    }
  }, [innerTable, innerTableWrapper, bottomScrollListener, observer, log, debugName])

  return { wrapperRef, scrollBarWrapperRef, topScrollListener, scrollBarRef, tableAriaId }
}

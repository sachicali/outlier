import React from 'react'

interface LoadingSkeletonProps {
  className?: string
  width?: string | number
  height?: string | number
  rounded?: boolean
  animation?: 'pulse' | 'shimmer' | 'none'
}

const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({
  className = '',
  width,
  height,
  rounded = true,
  animation = 'pulse'
}) => {
  const animationClass = {
    pulse: 'animate-pulse',
    shimmer: 'animate-shimmer',
    none: ''
  }[animation]

  const style: React.CSSProperties = {
    ...(width && { width }),
    ...(height && { height })
  }

  return (
    <div
      className={`
        bg-gray-200 dark:bg-gray-700
        ${rounded ? 'rounded' : ''}
        ${animationClass}
        ${className}
      `}
      style={style}
    />
  )
}

export default LoadingSkeleton
import { useMemo } from 'react'
import { countries, citiesByCountry, type Country } from '../data/cities'

export function useLocationData() {
  const countriesList = useMemo(() => countries, [])

  const citiesMap = useMemo(() => citiesByCountry, [])

  function getCitiesByCountry(cca2: string): string[] {
    return citiesMap[cca2] || []
  }

  function findCountryByCca2(cca2: string): Country | undefined {
    return countriesList.find((c) => c.cca2 === cca2)
  }

  function findCountryByName(name: string): Country | undefined {
    return countriesList.find((c) => c.name.toLowerCase() === name.toLowerCase().trim())
  }

  function findCca2ByCountryName(name: string): string | undefined {
    return findCountryByName(name)?.cca2
  }

  function getCitySuggestions(cca2: string, query: string): string[] {
    const cities = getCitiesByCountry(cca2)
    if (!query) return cities
    const q = query.toLowerCase()
    return cities.filter((city) => city.toLowerCase().includes(q))
  }

  return {
    countries: countriesList,
    citiesByCountry: citiesMap,
    getCitiesByCountry,
    findCountryByCca2,
    findCountryByName,
    findCca2ByCountryName,
    getCitySuggestions,
  }
}

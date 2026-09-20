// Explicit reference recipes, calculated from existing library ingredients.
// Values are estimates, not restaurant or brand nutrition declarations.
import { readFileSync, writeFileSync } from 'node:fs'
const base = new URL('./', import.meta.url)
const foods = JSON.parse(readFileSync(new URL('food_database.json', base), 'utf8'))
const recipes = JSON.parse(readFileSync(new URL('recipe_estimates.json', base), 'utf8'))
const quote = s => "'" + s.replaceAll("'", "''") + "'"
let sql = '-- Apply after 002_food_discovery.sql. Additive, rerunnable: never deletes existing foods.\n'
for (const recipe of recipes) {
  const totals = Object.fromEntries(['calories','protein_g','carbs_g','fat_g','fiber_g','iron_mg'].map(k=>[k,0]))
  for (const [name, amount] of Object.entries(recipe.ingredients)) {
    const food = foods.find(f => f.name === name)
    if (!food || (food.serving_unit ?? 'g') !== amount.unit) throw new Error(`Mismatched ingredient unit: ${name}`)
    for (const key of Object.keys(totals)) totals[key] += (food[key] ?? 0) * amount.quantity / (food.serving_size ?? 100)
  }
  const description = Object.entries(recipe.ingredients).map(([name, amount])=>`${name} ${amount.quantity}${amount.unit}`).join(' + ')
  const values = [quote(recipe.name),quote(recipe.name_en),`ARRAY[${recipe.alias.map(quote).join(',')}]::text[]`,"'外食'",'1',"'份'",...Object.values(totals).map(n=>String(Math.round(n*10)/10)),"'FemFit recipe estimate'",quote(description)]
  sql += `\ninsert into public.food_database (name,name_en,alias,category,serving_size,serving_unit,calories,protein_g,carbs_g,fat_g,fiber_g,iron_mg,source,serving_description)\nselect ${values.join(',')}\nwhere not exists (select 1 from public.food_database where name=${quote(recipe.name)});\n`
}
writeFileSync(new URL('recipe_estimates.sql', base), sql)
